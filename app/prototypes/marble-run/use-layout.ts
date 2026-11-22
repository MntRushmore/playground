"use client";

// Track layout state: pieces + undo history, persisted (versioned, validated) to
// localStorage. An external store read with useSyncExternalStore: the server and the
// hydration pass see the default run; the client then reads storage once.

import { useMemo, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "@/lib/storage";
import { MAX_HISTORY, MAX_PIECES, PLACE_ANGLE, SLUG } from "./data";
import { DEFAULT_PIECES } from "./default-layout";
import { clampToBoard, newId, normalizeAngle, sanitizeLayout, toStored } from "./board-layout";
import type { Piece, PieceType } from "./types";

type State = { pieces: readonly Piece[]; past: readonly (readonly Piece[])[] };

const SERVER: State = { pieces: DEFAULT_PIECES, past: [] };
let state: State | null = null;
const listeners = new Set<() => void>();

function current(): State {
  if (!state) state = { pieces: sanitizeLayout(readStorage(SLUG, "layout", null)) ?? DEFAULT_PIECES, past: [] };
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function commit(next: readonly Piece[]) {
  const s = current();
  if (next === s.pieces) return;
  state = { pieces: next, past: [...s.past, s.pieces].slice(-MAX_HISTORY) };
  writeStorage(SLUG, "layout", toStored(next));
  listeners.forEach((l) => l());
}

function undo() {
  const s = current();
  const prev = s.past[s.past.length - 1];
  if (!prev) return;
  state = { pieces: prev, past: s.past.slice(0, -1) };
  writeStorage(SLUG, "layout", toStored(prev));
  listeners.forEach((l) => l());
}

const patch = (id: string, fn: (p: Piece) => Piece) =>
  commit(current().pieces.map((p) => (p.id === id ? fn(p) : p)));

export const layoutActions = {
  /** Adds a piece and returns its id (or null when the board is full). */
  place(type: PieceType, x: number, y: number): string | null {
    const pieces = current().pieces;
    if (pieces.length >= MAX_PIECES) return null;
    const pos = clampToBoard(x, y);
    const piece: Piece = { id: newId(), type, x: pos.x, y: pos.y, angle: PLACE_ANGLE[type] ?? 0, flip: false };
    commit([...pieces, piece]);
    return piece.id;
  },
  move(id: string, x: number, y: number, angle?: number) {
    const pos = clampToBoard(x, y);
    patch(id, (p) => ({ ...p, x: pos.x, y: pos.y, angle: angle ?? p.angle }));
  },
  rotate(id: string, delta: number) {
    patch(id, (p) => ({ ...p, angle: normalizeAngle(p.angle + delta) }));
  },
  setAngle(id: string, angle: number) {
    patch(id, (p) => ({ ...p, angle: normalizeAngle(angle) }));
  },
  flip(id: string) {
    patch(id, (p) => ({ ...p, flip: !p.flip }));
  },
  remove(id: string) {
    commit(current().pieces.filter((p) => p.id !== id));
  },
  duplicate(id: string): string | null {
    const pieces = current().pieces;
    const src = pieces.find((p) => p.id === id);
    if (!src || pieces.length >= MAX_PIECES) return null;
    const pos = clampToBoard(src.x + 50, src.y + 50);
    const copy = { ...src, id: newId(), x: pos.x, y: pos.y };
    commit([...pieces, copy]);
    return copy.id;
  },
  restoreDefault() {
    commit(DEFAULT_PIECES);
  },
  clear() {
    commit([]);
  },
  undo,
};

export function useLayout() {
  const s = useSyncExternalStore(subscribe, current, () => SERVER);
  return useMemo(() => ({ pieces: s.pieces, canUndo: s.past.length > 0 }), [s]);
}
