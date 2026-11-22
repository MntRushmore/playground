"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { readStorage, writeStorage } from "@/lib/storage";
import { DEFAULT_LAYOUT, MAX_DPR, SLUG } from "./data";
import { sanitizeLayout } from "./arrangement";
import { MarbleMachine } from "./machine";
import type { NoteEvent, Settings, ThemeColors } from "./types";

/** Canvas can't use Tailwind classes, so read the design tokens at runtime. */
function readTheme(el: HTMLElement, resolvedTheme: string | undefined): ThemeColors {
  const css = getComputedStyle(el);
  return {
    background: css.getPropertyValue("--background").trim() || "Canvas",
    foreground: css.getPropertyValue("--foreground").trim() || "CanvasText",
    font: css.fontFamily || "sans-serif",
    dark: resolvedTheme !== "light",
  };
}

export function MarbleCanvas({
  settings,
  emitting,
  live,
  machineRef,
  onNote,
  onPointerDown,
}: {
  settings: Settings;
  emitting: boolean;
  live: boolean;
  machineRef: React.RefObject<MarbleMachine | null>;
  onNote: (note: NoteEvent) => void;
  /** Runs before the machine sees the press (used to unlock audio inside the gesture). */
  onPointerDown?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const onNoteRef = useRef(onNote);
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  // Create the machine once; everything else is pushed into it imperatively by the
  // effects below (declared after, so on mount they run after creation).
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !canvas.getContext("2d")) return;

    const stored = sanitizeLayout(readStorage(SLUG, "layout", null));
    const machine = new MarbleMachine(
      canvas,
      settingsRef.current,
      readTheme(container, undefined),
      stored ?? DEFAULT_LAYOUT,
      {
        onNote: (n) => onNoteRef.current(n),
        onLayoutChange: (layout) => writeStorage(SLUG, "layout", layout),
      }
    );
    machine.setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    machineRef.current = machine;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      machine.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, MAX_DPR));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    machine.start();

    return () => {
      observer.disconnect();
      machine.destroy();
      machineRef.current = null;
    };
  }, [machineRef]);

  useEffect(() => {
    onNoteRef.current = onNote;
  }, [onNote]);

  useEffect(() => {
    settingsRef.current = settings;
    machineRef.current?.setSettings(settings);
  }, [settings, machineRef]);

  useEffect(() => machineRef.current?.setEmitting(emitting), [emitting, machineRef]);
  useEffect(() => machineRef.current?.setLive(live), [live, machineRef]);
  useEffect(() => machineRef.current?.setReducedMotion(reducedMotion), [reducedMotion, machineRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) machineRef.current?.setTheme(readTheme(container, resolvedTheme));
  }, [resolvedTheme, machineRef]);

  const handle = (type: "down" | "move" | "up" | "cancel", e: React.PointerEvent<HTMLCanvasElement>) => {
    if (type === "down") {
      try {
        // Keep receiving moves when a finger slides off the canvas.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer already gone (or synthetic): nothing to capture.
      }
      onPointerDown?.();
    }
    machineRef.current?.pointer(type, e.nativeEvent);
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-80 flex-1 touch-none overflow-hidden bg-background select-none [-webkit-touch-callout:none]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full animate-in fade-in duration-500"
        aria-label="Marble machine: tap to drop a marble, drag bars to move them"
        role="img"
        onPointerDown={(e) => handle("down", e)}
        onPointerMove={(e) => handle("move", e)}
        onPointerUp={(e) => handle("up", e)}
        onPointerCancel={(e) => handle("cancel", e)}
        onLostPointerCapture={(e) => handle("up", e)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
