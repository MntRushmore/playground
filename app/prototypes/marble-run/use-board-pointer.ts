"use client";

// Pointer interactions on the board: tap to place / select / drop a marble, drag to move
// (grid + track-end snapping), drag the handle to rotate (15° snaps). One pointer at a time.

import { useCallback, useRef } from "react";
import { WORLD } from "./data";
import { handlePoint, hitTest } from "./transforms";
import { clampToBoard, insideBoard, screenToWorld, snapAngle, snapToConnectors, snapToGrid } from "./board-layout";
import { spawnMarble, syncPieces, type Sim } from "./physics";
import { HANDLE_GAP_PX, HANDLE_R_PX } from "./render";
import type { Ghost, Piece, PieceType, View } from "./types";

export type BoardShared = {
  view: View;
  pieces: readonly Piece[];
  selectedId: string | null;
  armed: PieceType | null;
  snap: boolean;
  /** Piece being dragged or rotated (overrides the committed one). */
  live: Piece | null;
  rotating: number | null;
  ghost: Ghost | null;
  sim: Sim | null;
};

export type BoardCallbacks = {
  onSelect: (id: string | null) => void;
  onPlace: (type: PieceType, x: number, y: number) => void;
  onCommit: (id: string, x: number, y: number, angle: number) => void;
  onDragChange: (dragging: boolean) => void;
  onGesture: () => void;
};

type Gesture =
  | { kind: "press"; id: string; pointer: number; sx: number; sy: number; dx: number; dy: number; moved: boolean }
  | { kind: "rotate"; id: string; pointer: number }
  | null;

/** Applies the live override to the physics so marbles react while you drag. */
export function syncWithLive(shared: BoardShared) {
  if (!shared.sim) return;
  const live = shared.live;
  syncPieces(shared.sim, live ? shared.pieces.map((p) => (p.id === live.id ? live : p)) : shared.pieces);
}

export function placementPoint(shared: BoardShared, type: PieceType, x: number, y: number, angle: number) {
  let pos = clampToBoard(x, y);
  if (shared.snap) pos = snapToGrid(pos);
  const probe: Piece = { id: "__probe", type, x: pos.x, y: pos.y, angle, flip: false };
  return snapToConnectors(probe, shared.pieces) ?? pos;
}

export function useBoardPointer(sharedRef: React.RefObject<BoardShared>, cb: React.RefObject<BoardCallbacks>) {
  const gesture = useRef<Gesture>(null);

  const local = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const shared = sharedRef.current;
      if (gesture.current || !e.isPrimary || e.button > 0) return;
      cb.current.onGesture();
      const { sx, sy } = local(e);
      const v = shared.view;
      const w = screenToWorld(v, sx, sy);
      const pad = (e.pointerType === "touch" ? 16 : 7) / v.scale;

      const selected = shared.pieces.find((p) => p.id === shared.selectedId);
      if (selected) {
        const h = handlePoint(selected, HANDLE_GAP_PX / v.scale);
        if (Math.hypot(w.x - h.x, w.y - h.y) <= (HANDLE_R_PX + (e.pointerType === "touch" ? 12 : 5)) / v.scale) {
          gesture.current = { kind: "rotate", id: selected.id, pointer: e.pointerId };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          shared.live = { ...selected };
          shared.rotating = selected.angle;
          cb.current.onDragChange(true);
          return;
        }
      }

      if (shared.armed) {
        if (!insideBoard(w.x, w.y, 40)) return;
        const pos = placementPoint(shared, shared.armed, w.x, w.y, 0);
        shared.ghost = null;
        cb.current.onPlace(shared.armed, pos.x, pos.y);
        return;
      }

      // Topmost first; prefer the selected piece when pieces overlap.
      const order = [...shared.pieces].reverse();
      const hit =
        (selected && hitTest(selected, w.x, w.y, pad) ? selected : null) ??
        order.find((p) => hitTest(p, w.x, w.y, pad));
      if (hit) {
        cb.current.onSelect(hit.id);
        gesture.current = { kind: "press", id: hit.id, pointer: e.pointerId, sx, sy, dx: w.x - hit.x, dy: w.y - hit.y, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
      if (shared.selectedId) {
        cb.current.onSelect(null);
        return;
      }
      if (shared.sim && insideBoard(w.x, w.y) && w.y < WORLD.height - 20) {
        spawnMarble(shared.sim, w.x, w.y);
      }
    },
    [sharedRef, cb]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const shared = sharedRef.current;
      const g = gesture.current;
      const { sx, sy } = local(e);
      const v = shared.view;
      const w = screenToWorld(v, sx, sy);
      if (!g) {
        if (shared.armed && e.pointerType === "mouse") {
          const pos = placementPoint(shared, shared.armed, w.x, w.y, 0);
          shared.ghost = { type: shared.armed, x: pos.x, y: pos.y, angle: 0, valid: insideBoard(w.x, w.y, 40) };
        }
        return;
      }
      if (e.pointerId !== g.pointer) return;
      const base = shared.pieces.find((p) => p.id === g.id);
      if (!base) return;
      if (g.kind === "rotate") {
        const raw = (Math.atan2(w.y - base.y, w.x - base.x) * 180) / Math.PI + 90;
        const angle = snapAngle(raw);
        shared.rotating = angle;
        if (!shared.live || shared.live.angle !== angle) {
          shared.live = { ...base, angle };
          syncWithLive(shared);
        }
        return;
      }
      if (!g.moved) {
        const slop = e.pointerType === "touch" ? 7 : 3;
        if (Math.hypot(sx - g.sx, sy - g.sy) < slop) return;
        g.moved = true;
        cb.current.onDragChange(true);
      }
      let pos = clampToBoard(w.x - g.dx, w.y - g.dy);
      if (shared.snap) pos = snapToGrid(pos);
      const probe = { ...base, x: pos.x, y: pos.y };
      const snapped = snapToConnectors(probe, shared.pieces);
      const next = snapped ? { ...probe, ...snapped } : probe;
      if (!shared.live || shared.live.x !== next.x || shared.live.y !== next.y) {
        shared.live = next;
        syncWithLive(shared);
      }
    },
    [sharedRef, cb]
  );

  const finish = useCallback(
    (e: React.PointerEvent, cancelled: boolean) => {
      const shared = sharedRef.current;
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointer) return;
      gesture.current = null;
      const live = shared.live;
      shared.live = null;
      shared.rotating = null;
      const moved = g.kind === "rotate" || g.moved;
      if (moved) cb.current.onDragChange(false);
      if (live && moved && !cancelled) cb.current.onCommit(live.id, live.x, live.y, live.angle);
      else syncWithLive(shared);
    },
    [sharedRef, cb]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => finish(e, false), [finish]);
  const onPointerCancel = useCallback((e: React.PointerEvent) => finish(e, true), [finish]);
  const onPointerLeave = useCallback(() => {
    if (!gesture.current) sharedRef.current.ghost = null;
  }, [sharedRef]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave };
}
