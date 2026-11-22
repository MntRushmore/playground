"use client";

import { useTheme } from "next-themes";
import { type Ref, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { quantize, simplify } from "./carving";
import { ETCH_WIDTH_FACTOR, KNIFE_UNIT, MAX_DPR, NIGHT_COLOR, STAMPS } from "./data";
import { type Engine, createEngine } from "./engine";
import type { Op, Settings, StampId, StampOp, StrokeOp, Tool } from "./types";
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
  stamp: StampId;
  mirror: boolean;
  onCommit: (op: Op) => void;
  ref?: Ref<PumpkinCanvasHandle>;
};

type Drag = { id: number; op: StrokeOp | StampOp; rect: DOMRect };

export function PumpkinCanvas({ settings, ready, ops, lit, dark, tool, stamp, mirror, onCommit, ref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const inputRef = useRef({ settings, tool, stamp, mirror, onCommit });
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    inputRef.current = { settings, tool, stamp, mirror, onCommit };
  }, [settings, tool, stamp, mirror, onCommit]);

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
  useEffect(() => {
    if (tool !== "stamp") engineRef.current?.setPreview(null);
  }, [tool]);

  const onInset = useCallback((px: number) => engineRef.current?.setBottomInset(px), []);
  useSheetInset(containerRef, onInset);

  useImperativeHandle(ref, () => ({
    exportPng: () => engineRef.current?.exportPng() ?? Promise.resolve(null),
  }));

  const faceAt = (e: { clientX: number; clientY: number }, rect: DOMRect) =>
    engineRef.current?.toFace(e.clientX - rect.left, e.clientY - rect.top) ?? null;

  const stampOp = (x: number, y: number): StampOp => {
    const { stamp: s, settings: st, mirror: m } = inputRef.current;
    return { t: "stamp", s, x, y, k: STAMPS[s].size * st.stampSize, m };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm-safe: one carving pointer at a time; extra touches are ignored.
    if (dragRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const engine = engineRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const at = faceAt(e, rect);
    if (!engine || !at) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { tool: t, settings: st, mirror: m } = inputRef.current;
    if (t === "stamp") {
      const op = stampOp(at[0], at[1]);
      dragRef.current = { id: e.pointerId, op, rect };
      engine.setPreview(op);
    } else {
      const w = KNIFE_UNIT * st.knife * (t === "etch" ? ETCH_WIDTH_FACTOR : 1);
      const op: StrokeOp = { t: t === "knife" ? "cut" : "etch", w, p: [at[0], at[1]], m };
      dragRef.current = { id: e.pointerId, op, rect };
      engine.setLive([op]);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const drag = dragRef.current;
    if (!engine) return;
    if (!drag) {
      // Desktop: the stamp outline follows the cursor before clicking.
      if (inputRef.current.tool === "stamp" && e.pointerType === "mouse") {
        const at = faceAt(e, e.currentTarget.getBoundingClientRect());
        if (at) engine.setPreview(stampOp(at[0], at[1]));
      }
      return;
    }
    if (e.pointerId !== drag.id) return;
    const op = drag.op;
    if (op.t === "stamp") {
      const at = faceAt(e, drag.rect);
      if (at) {
        drag.op = { ...op, x: at[0], y: at[1] };
        engine.setPreview(drag.op);
      }
      return;
    }
    // Coalesced events give every sample the hardware saw between frames.
    const native = e.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    const minStep = Math.max(0.003, op.w * 0.18);
    for (const s of samples.length ? samples : [native]) {
      const at = faceAt(s, drag.rect);
      if (!at) continue;
      const n = op.p.length;
      if (Math.hypot(at[0] - op.p[n - 2], at[1] - op.p[n - 1]) >= minStep) op.p.push(at[0], at[1]);
    }
    engine.setLive([op]);
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>, commit: boolean) => {
    const drag = dragRef.current;
    const engine = engineRef.current;
    if (!drag || e.pointerId !== drag.id || !engine) return;
    dragRef.current = null;
    const op = drag.op;
    if (!commit) {
      engine.setLive([]);
      engine.setPreview(null);
      return;
    }
    if (op.t === "stamp") {
      inputRef.current.onCommit(op);
      if (e.pointerType !== "mouse") engine.setPreview(null);
      navigator.vibrate?.(12);
    } else {
      const done: StrokeOp = { ...op, p: quantize(simplify(op.p, op.w * 0.04)) };
      engine.setLive([done]);
      inputRef.current.onCommit(done);
    }
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
        onPointerLeave={(e) => {
          if (!dragRef.current && e.pointerType === "mouse") engineRef.current?.setPreview(null);
        }}
      />
    </div>
  );
}
