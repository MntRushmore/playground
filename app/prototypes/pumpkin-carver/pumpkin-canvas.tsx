"use client";

import { useTheme } from "next-themes";
import { type Ref, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { quantize, simplify } from "./carving";
import { ETCH_WIDTH_FACTOR, KNIFE_UNIT, MAX_DPR, NIGHT_COLOR, PATCH_WIDTH_FACTOR } from "./data";
import { type Engine, createEngine } from "./engine";
import { sound } from "./sound";
import type { Op, Settings, StrokeOp, Tool } from "./types";
import { useSheetInset } from "./use-sheet-inset";

export type PumpkinCanvasHandle = { exportPng: () => Promise<Blob | null> };

type Props = {
  settings: Settings;
  /** False until persisted settings are loaded, so we don't render the defaults first. */
  ready: boolean;
  ops: readonly Op[];
  lit: boolean;
  dark: boolean;
  tool: Tool;
  onCommit: (op: Op) => void;
  onStroke?: () => void;
  ref?: Ref<PumpkinCanvasHandle>;
};

type Drag = { id: number; op: StrokeOp; rect: DOMRect; lastT: number };

const STROKE_TYPE: Record<Tool, StrokeOp["t"]> = { carve: "cut", etch: "etch", patch: "patch" };
const WIDTH_FACTOR: Record<Tool, number> = { carve: 1, etch: ETCH_WIDTH_FACTOR, patch: PATCH_WIDTH_FACTOR };

export function PumpkinCanvas({ settings, ready, ops, lit, dark, tool, onCommit, onStroke, ref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const inputRef = useRef({ settings, tool, onCommit, onStroke });
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    inputRef.current = { settings, tool, onCommit, onStroke };
  }, [settings, tool, onCommit, onStroke]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const engine = createEngine(canvas);
    engineRef.current = engine;
    const resize = () => {
      const r = container.getBoundingClientRect();
      engine.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, MAX_DPR));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) engineRef.current?.setSettings(settings);
  }, [settings, ready]);
  useEffect(() => {
    engineRef.current?.setOps(ops);
    // The stroke under the finger is now part of ops.
    if (!dragRef.current) engineRef.current?.setLive([]);
  }, [ops]);
  useEffect(() => engineRef.current?.setTarget({ lit, dark }), [lit, dark]);
  useEffect(() => engineRef.current?.setReducedMotion(reducedMotion), [reducedMotion]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const isDark = resolvedTheme !== "light";
    engineRef.current?.setTheme({
      background: css.getPropertyValue("--background").trim() || "Canvas",
      foreground: css.getPropertyValue("--foreground").trim() || "CanvasText",
      night: isDark ? NIGHT_COLOR.dark : NIGHT_COLOR.light,
      dark: isDark,
    });
  }, [resolvedTheme]);

  const onInset = useCallback((px: number) => engineRef.current?.setBottomInset(px), []);
  useSheetInset(containerRef, onInset);

  useImperativeHandle(ref, () => ({
    exportPng: () => engineRef.current?.exportPng() ?? Promise.resolve(null),
  }));

  const faceAt = (e: { clientX: number; clientY: number }, rect: DOMRect) =>
    engineRef.current?.toFace(e.clientX - rect.left, e.clientY - rect.top) ?? null;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm-safe: one carving pointer at a time; extra touches are ignored.
    if (dragRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const engine = engineRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const at = faceAt(e, rect);
    if (!engine || !at) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { tool: t, settings: st } = inputRef.current;
    const op: StrokeOp = { t: STROKE_TYPE[t], w: KNIFE_UNIT * st.knife * WIDTH_FACTOR[t], p: [at[0], at[1]] };
    dragRef.current = { id: e.pointerId, op, rect, lastT: e.timeStamp };
    engine.setLive([op]);
    sound.carveStart(t);
    inputRef.current.onStroke?.();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const drag = dragRef.current;
    if (!engine || !drag || e.pointerId !== drag.id) return;
    const op = drag.op;
    // Coalesced events give every sample the hardware saw between frames.
    const native = e.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    const minStep = Math.max(0.003, op.w * 0.18);
    let moved = 0;
    for (const s of samples.length ? samples : [native]) {
      const at = faceAt(s, drag.rect);
      if (!at) continue;
      const n = op.p.length;
      const d = Math.hypot(at[0] - op.p[n - 2], at[1] - op.p[n - 1]);
      if (d >= minStep) {
        op.p.push(at[0], at[1]);
        moved += d;
      }
    }
    const dt = Math.max(8, e.timeStamp - drag.lastT);
    drag.lastT = e.timeStamp;
    sound.carveMove((moved / dt) * 300, inputRef.current.tool);
    engine.setLive([op]);
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>, commit: boolean) => {
    const drag = dragRef.current;
    const engine = engineRef.current;
    if (!drag || e.pointerId !== drag.id || !engine) return;
    dragRef.current = null;
    sound.carveEnd();
    if (!commit) {
      engine.setLive([]);
      return;
    }
    const done: StrokeOp = { ...drag.op, p: quantize(simplify(drag.op.p, drag.op.w * 0.04)) };
    engine.setLive([done]);
    inputRef.current.onCommit(done);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 bg-background">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Pumpkin carving surface"
        className="absolute inset-0 size-full cursor-crosshair touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
      />
    </div>
  );
}
