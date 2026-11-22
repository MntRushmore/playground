// Carving history + scene prefs as a tiny external store (useSyncExternalStore), loaded
// lazily from localStorage on the client and saved on every change.

import { useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "@/lib/storage";
import { DEFAULT_OPS, SLUG } from "./data";
import { visibleOps } from "./carving";
import { loadOps, saveOps } from "./persist";
import type { Op } from "./types";

export type ScenePrefs = { lit: boolean; dark: boolean; mirror: boolean };
export type CarvingState = { ops: readonly Op[]; prefs: ScenePrefs };

const DEFAULT_PREFS: ScenePrefs = { lit: true, dark: true, mirror: false };
const SERVER_STATE: CarvingState = { ops: DEFAULT_OPS, prefs: DEFAULT_PREFS };

let state: CarvingState | null = null;
const listeners = new Set<() => void>();
let onSaveFailed: (() => void) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function load(): CarvingState {
  const raw = readStorage<Partial<ScenePrefs> | null>(SLUG, "scene", null);
  const prefs = { ...DEFAULT_PREFS };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(DEFAULT_PREFS) as (keyof ScenePrefs)[]) {
      if (typeof raw[k] === "boolean") prefs[k] = raw[k];
    }
  }
  return { ops: loadOps(SLUG) ?? DEFAULT_OPS, prefs };
}

function current() {
  if (!state) state = load();
  return state;
}

function set(next: CarvingState) {
  const prev = current();
  state = next;
  listeners.forEach((l) => l());
  if (next.prefs !== prev.prefs) writeStorage(SLUG, "scene", next.prefs);
  if (next.ops !== prev.ops) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!saveOps(SLUG, current().ops)) onSaveFailed?.();
    }, 250);
  }
}

export const carving = {
  commit(op: Op) {
    const s = current();
    set({ ...s, ops: [...s.ops, op] });
  },
  undo() {
    const s = current();
    if (s.ops.length) set({ ...s, ops: s.ops.slice(0, -1) });
  },
  /** Clearing is an op, so it can be undone. */
  clear() {
    const s = current();
    if (visibleOps(s.ops).length) set({ ...s, ops: [...s.ops, { t: "clear" }] });
  },
  setPref<K extends keyof ScenePrefs>(key: K, value: ScenePrefs[K]) {
    const s = current();
    set({ ...s, prefs: { ...s.prefs, [key]: value } });
  },
  /** Called (at most once per failed save) when storage is full. */
  onSaveFailed(cb: (() => void) | null) {
    onSaveFailed = cb;
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCarving(): CarvingState {
  return useSyncExternalStore(subscribe, current, () => SERVER_STATE);
}
