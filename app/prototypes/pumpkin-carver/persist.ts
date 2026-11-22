// Saving the carving as ops (not pixels): small, resolution-independent, and validated
// on load since localStorage is untrusted.

import { readStorage, storageKey, writeStorage } from "@/lib/storage";
import { STAMPS } from "./data";
import { quantize, simplify, visibleOps } from "./carving";
import type { Op } from "./types";

const KEY = "carving";
const VERSION = 1;

type Stored = { v: number; ops: Op[] };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function validOp(raw: unknown): Op | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.t === "clear") return { t: "clear" };
  if ((o.t === "cut" || o.t === "etch") && isNum(o.w) && Array.isArray(o.p)) {
    const p = o.p.filter(isNum);
    if (p.length < 2 || p.length % 2) return null;
    return { t: o.t, w: Math.min(0.5, Math.max(0.002, o.w)), p, m: o.m === true };
  }
  if (o.t === "stamp" && typeof o.s === "string" && o.s in STAMPS && isNum(o.x) && isNum(o.y) && isNum(o.k)) {
    return { t: "stamp", s: o.s as keyof typeof STAMPS, x: o.x, y: o.y, k: Math.min(1, Math.max(0.02, o.k)), m: o.m === true };
  }
  return null;
}

/** Stored ops, or null if nothing (valid) was ever saved. */
export function loadOps(slug: string): Op[] | null {
  const raw = readStorage<Stored | null>(slug, KEY, null);
  if (!raw || typeof raw !== "object" || raw.v !== VERSION || !Array.isArray(raw.ops)) return null;
  return raw.ops.map(validOp).filter((op): op is Op => op !== null);
}

/** Lighter version of the carving: only what's visible, coarser strokes. */
function compact(ops: readonly Op[], eps: number): Op[] {
  return visibleOps(ops).map((op) =>
    op.t === "stamp" ? op : { ...op, p: quantize(simplify(op.p, eps)) }
  );
}

function tryWrite(slug: string, ops: Op[]) {
  const value: Stored = { v: VERSION, ops };
  writeStorage(slug, KEY, value);
  // writeStorage swallows quota errors, so confirm the write landed.
  try {
    return window.localStorage.getItem(storageKey(slug, KEY))?.length === JSON.stringify(value).length;
  } catch {
    return false;
  }
}

/**
 * Saves ops, falling back to progressively lighter versions if storage is full.
 * Returns false if even the lightest version didn't fit.
 */
export function saveOps(slug: string, ops: readonly Op[]): boolean {
  if (tryWrite(slug, ops.map((op) => (op.t === "clear" || op.t === "stamp" ? op : { ...op, p: quantize(op.p) })))) {
    return true;
  }
  return tryWrite(slug, compact(ops, 0.004)) || tryWrite(slug, compact(ops, 0.012));
}
