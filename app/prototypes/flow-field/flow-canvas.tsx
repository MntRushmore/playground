"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { MAX_DPR, STILL_FRAME } from "./data";
import { createNoise3D } from "./noise";
import { fadeAlpha, hueBucket, solidColor, spectrumColors } from "./palette";
import { resizePool, stepParticles } from "./simulation";
import type { Bounds, FlowSettings, Particle, ThemeColors } from "./types";

/** Canvas can't use Tailwind classes, so read the design tokens at runtime. */
function readThemeColors(el: HTMLElement, resolvedTheme: string | undefined): ThemeColors {
  const css = getComputedStyle(el);
  return {
    background: css.getPropertyValue("--background").trim() || "Canvas",
    foreground: css.getPropertyValue("--foreground").trim() || "CanvasText",
    dark: resolvedTheme !== "light",
  };
}

export function FlowCanvas({ settings }: { settings: FlowSettings }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const redrawStillRef = useRef<(() => void) | null>(null);
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    settingsRef.current = settings;
    // Reduced motion: the still image is redrawn whenever a setting changes.
    redrawStillRef.current?.();
  }, [settings]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    const theme = readThemeColors(container, resolvedTheme);
    const pool: Particle[] = [];
    let bounds: Bounds = { width: 0, height: 0 };
    let pxScale = 1;
    let seed = settingsRef.current.seed;
    let noise = createNoise3D(seed);
    let spectrum = spectrumColors(seed, theme);
    let time = 0;
    let raf = 0;
    let last = performance.now();

    const fill = (alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, bounds.width, bounds.height);
      ctx.globalAlpha = 1;
    };

    const syncSeed = (s: FlowSettings) => {
      if (s.seed === seed) return;
      seed = s.seed;
      noise = createNoise3D(seed);
      spectrum = spectrumColors(seed, theme);
    };

    const strokeParticles = (s: FlowSettings) => {
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      if (s.palette === "spectrum") {
        const paths = spectrum.map(() => new Path2D());
        for (const p of pool) {
          const path = paths[hueBucket(p.angle)];
          path.moveTo(p.px, p.py);
          path.lineTo(p.x, p.y);
        }
        paths.forEach((path, i) => {
          ctx.strokeStyle = spectrum[i];
          ctx.stroke(path);
        });
      } else {
        const path = new Path2D();
        for (const p of pool) {
          path.moveTo(p.px, p.py);
          path.lineTo(p.x, p.y);
        }
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = solidColor(s, theme);
        ctx.stroke(path);
        ctx.globalAlpha = 1;
      }
    };

    const frame = (dt: number) => {
      const s = settingsRef.current;
      syncSeed(s);
      resizePool(pool, s.count, bounds);
      time += s.evolution * 0.004 * dt;
      stepParticles(pool, noise, time, s, bounds, dt, pxScale);
      fill(fadeAlpha(s.trails));
      strokeParticles(s);
    };

    // Reduced motion: one still image of streamlines instead of an animation.
    const drawStill = () => {
      const s = settingsRef.current;
      syncSeed(s);
      pool.length = 0;
      resizePool(pool, Math.min(s.count, STILL_FRAME.maxParticles), bounds);
      fill(1);
      for (let i = 0; i < STILL_FRAME.steps; i++) {
        stepParticles(pool, noise, time, s, bounds, 1, pxScale);
        strokeParticles(s);
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bounds = { width: rect.width, height: rect.height };
      pxScale = Math.min(2, Math.max(0.6, Math.min(rect.width, rect.height) / 600));
      pool.length = 0;
      resizePool(pool, settingsRef.current.count, bounds);
      fill(1);
      if (reducedMotion) drawStill();
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / (1000 / 60), 3);
      last = now;
      frame(dt);
      raf = requestAnimationFrame(tick);
    };

    redrawStillRef.current = reducedMotion ? drawStill : null;
    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    if (!reducedMotion) raf = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      redrawStillRef.current = null;
    };
  }, [resolvedTheme, reducedMotion]);

  return (
    <div ref={containerRef} className="relative min-h-80 flex-1 bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="Flow field" />
    </div>
  );
}
