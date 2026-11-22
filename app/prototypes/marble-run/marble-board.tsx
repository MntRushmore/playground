"use client";

import { useTheme } from "next-themes";
import { useEffect, useImperativeHandle, useRef } from "react";
import { MAX_DPR, WARMUP_MS } from "./data";
import { fitView, insideBoard, screenToWorld } from "./board-layout";
import { clearMarbles, createSim, drainEvents, stepSim, warmUp } from "./physics";
import { computePosts } from "./posts";
import { buildLayers, drawFrame, type Layers } from "./render";
import type { Sound } from "./sound";
import { boardPalette, readTheme, type BoardPalette } from "./theme";
import { placementPoint, syncWithLive, useBoardPointer, type BoardCallbacks, type BoardShared } from "./use-board-pointer";
import type { Piece, PieceType, PieceVisual, Settings, View } from "./types";

export type BoardApi = {
  clearMarbles: () => void;
  /** Ghost preview while dragging a piece in from the tray (client coords). */
  previewAt: (type: PieceType | null, clientX: number, clientY: number) => { x: number; y: number } | null;
};

type Props = BoardCallbacks & {
  apiRef: React.Ref<BoardApi>;
  pieces: readonly Piece[];
  settings: Settings;
  running: boolean;
  selectedId: string | null;
  armed: PieceType | null;
  trayRef: React.RefObject<HTMLElement | null>;
  sound: Sound;
  onViewChange: (view: View) => void;
};

const EMPTY_VIEW: View = { scale: 1, ox: 0, oy: 0, width: 0, height: 0 };

export function MarbleBoard(props: Props) {
  const { apiRef, pieces, settings, running, selectedId, armed, trayRef, sound } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const shared = useRef<BoardShared>({
    view: EMPTY_VIEW,
    pieces,
    selectedId,
    armed,
    snap: settings.snap,
    live: null,
    rotating: null,
    ghost: null,
    sim: null,
  });
  const callbacks = useRef<BoardCallbacks>(props);
  const settingsRef = useRef(settings);
  const runningRef = useRef(running);
  const viewChange = useRef(props.onViewChange);
  const soundRef = useRef(sound);

  useEffect(() => {
    callbacks.current = props;
    viewChange.current = props.onViewChange;
    soundRef.current = sound;
    settingsRef.current = settings;
    runningRef.current = running;
    const s = shared.current;
    s.selectedId = selectedId;
    s.armed = armed;
    s.snap = settings.snap;
    if (!armed) s.ghost = null;
  });

  // Physics world: created once (warmed up on the first frame, once the stored layout is in).
  useEffect(() => {
    const s = shared.current;
    s.sim = createSim(settingsRef.current);
    syncWithLive(s);
    return () => {
      s.sim = null;
    };
  }, []);

  useEffect(() => {
    shared.current.pieces = pieces;
    syncWithLive(shared.current);
  }, [pieces]);

  useImperativeHandle(apiRef, () => ({
    clearMarbles: () => {
      if (shared.current.sim) clearMarbles(shared.current.sim);
    },
    previewAt: (type, clientX, clientY) => {
      const s = shared.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!type || !rect) {
        s.ghost = null;
        return null;
      }
      const w = screenToWorld(s.view, clientX - rect.left, clientY - rect.top);
      const inside = insideBoard(w.x, w.y, 20) && clientX >= rect.left && clientY >= rect.top && clientY <= rect.bottom;
      const pos = placementPoint(s, type, w.x, w.y, 0);
      s.ghost = { type, x: pos.x, y: pos.y, angle: 0, valid: inside };
      return inside ? pos : null;
    },
  }));

  const handlers = useBoardPointer(shared, callbacks);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;
    const layers: Layers = {
      body: document.createElement("canvas"),
      front: document.createElement("canvas"),
      lip: document.createElement("canvas"),
    };
    const pal: BoardPalette = boardPalette(readTheme(container, resolvedTheme));
    let dpr = 1;
    let cacheKey = "";
    let cachedPieces: readonly Piece[] | null = null;
    let raf = 0;
    let last = performance.now();
    let warmed = (shared.current.sim?.time ?? 0) > 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      for (const c of [canvas, layers.body, layers.front, layers.lip]) {
        c.width = w;
        c.height = h;
      }
      const tray = trayRef.current?.getBoundingClientRect() ?? null;
      const view = fitView(rect.width, rect.height, tray, { x: rect.left, y: rect.top });
      shared.current.view = view;
      cacheKey = "";
      viewChange.current(view);
    };

    const frame = (now: number) => {
      const s = shared.current;
      const sim = s.sim;
      const dt = Math.min(now - last, 100);
      last = now;
      if (!sim) return;
      if (!warmed) {
        warmed = true;
        warmUp(sim, WARMUP_MS);
      }
      stepSim(sim, dt, settingsRef.current, runningRef.current);
      const events = drainEvents(sim);
      soundRef.current.play(events);
      soundRef.current.setRolling(runningRef.current ? sim.rolling : 0);

      const liveId = s.live?.id ?? null;
      const key = `${liveId}|${s.view.scale}|${s.view.ox}|${s.view.oy}|${canvas.width}`;
      if (key !== cacheKey || cachedPieces !== s.pieces) {
        const statics = s.pieces.filter((p) => p.id !== liveId);
        buildLayers(layers, dpr, s.view, pal, statics, computePosts(statics));
        cachedPieces = s.pieces;
        cacheKey = key;
      }
      const visuals: PieceVisual[] = [];
      let live: PieceVisual | null = null;
      for (const rt of sim.pieces.values()) {
        const v = { piece: rt.piece, turn: rt.turn, belt: rt.belt, flash: rt.flash };
        visuals.push(v);
        if (rt.piece.id === liveId) live = v;
      }
      const selected = visuals.find((v) => v.piece.id === s.selectedId) ?? null;
      drawFrame(ctx, {
        dpr,
        view: s.view,
        pal,
        layers,
        visuals,
        live,
        livePosts: live ? computePosts([live.piece]) : [],
        marbles: sim.marbles,
        sparks: sim.sparks,
        trails: settingsRef.current.trails,
        overlay: {
          // While rotating, keep the handle on the live piece; while moving, hide it.
          selected: s.rotating !== null ? live : s.live ? null : selected,
          rotating: s.rotating,
          ghost: s.ghost,
          editing: Boolean(s.armed || s.selectedId || s.live || s.ghost),
        },
      });
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    if (trayRef.current) observer.observe(trayRef.current);
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf);
    };
    // Theme changes rebuild colors and caches.
  }, [resolvedTheme, trayRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 touch-none select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        aria-label="Marble run board"
        role="img"
        {...handlers}
      />
    </div>
  );
}
