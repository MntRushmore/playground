"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { FIELD_W, MAX_DPR } from "./data";
import type { BattleEngine } from "./engine";
import { readThemeInk } from "./palette";
import { renderScene } from "./render";
import type { ThemeInk } from "./types";

export function BattlefieldCanvas({
  engine,
  onInteract,
}: {
  engine: BattleEngine;
  onInteract: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const themeRef = useRef<ThemeInk>({ background: "#fff", foreground: "#000", dark: false });
  const wobbleRef = useRef(true);
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  // Keep juice / wobble in sync with the reduced-motion preference.
  useEffect(() => {
    wobbleRef.current = !reducedMotion;
    engine.setJuice(!reducedMotion);
  }, [engine, reducedMotion]);

  // Re-read the paper/ink tokens whenever the theme changes.
  useEffect(() => {
    if (containerRef.current) themeRef.current = readThemeInk(containerRef.current, resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    themeRef.current = readThemeInk(container, resolvedTheme);
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = rect.width / FIELD_W;
      scaleRef.current = scale;
      engine.setBounds({ width: FIELD_W, height: rect.height / scale });
      themeRef.current = readThemeInk(container, resolvedTheme);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!document.hidden) {
        engine.advance(dt);
        renderScene(
          ctx,
          { phase: engine.phase, world: engine.world, roster: engine.roster },
          { scale: scaleRef.current, theme: themeRef.current, time: now / 1000, wobble: wobbleRef.current }
        );
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisible = () => {
      last = performance.now();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    document.addEventListener("visibilitychange", onVisible);
    raf = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      cancelAnimationFrame(raf);
    };
  }, [engine, resolvedTheme]);

  // --- Pointer: paint squads along the stroke --------------------------------
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const toField = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = scaleRef.current;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
  };

  const place = (x: number, y: number, dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    // Spread the squad perpendicular to the stroke (vertical row for a tap).
    const px = len > 0.001 ? -dy / len : 0;
    const py = len > 0.001 ? dx / len : 1;
    engine.placeCluster(x, y, px, py);
  };

  const onDown = (e: React.PointerEvent) => {
    if (engine.demo) onInteract();
    if (engine.phase !== "draw") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = toField(e);
    lastPos.current = p;
    place(p.x, p.y, 0, 0);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || engine.phase !== "draw") return;
    const p = toField(e);
    const dx = p.x - lastPos.current.x;
    const dy = p.y - lastPos.current.y;
    if (Math.hypot(dx, dy) < 24) return; // spacing between squad rows
    place(p.x, p.y, dx, dy);
    lastPos.current = p;
  };

  const onUp = () => {
    drawing.current = false;
  };

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 bg-background">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        aria-label="Doodle Armies battlefield"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      />
    </div>
  );
}
