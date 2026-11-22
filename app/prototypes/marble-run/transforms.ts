// Piece transforms (local ⇄ world) and hit testing. Pure.

import { hitShape } from "./geometry";
import type { Piece, Prim, Vec } from "./types";

const DEG = Math.PI / 180;

export function rad(deg: number) {
  return deg * DEG;
}

/** Local point → world, applying mirror, rotation, translation. */
export function toWorld(p: Piece, lx: number, ly: number, extraTurn = 0): Vec {
  const x = p.flip ? -lx : lx;
  const a = rad(p.angle) + extraTurn;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x + x * c - ly * s, y: p.y + x * s + ly * c };
}

/** World point → local (inverse of toWorld). */
export function toLocal(p: Piece, wx: number, wy: number): Vec {
  const a = -rad(p.angle);
  const dx = wx - p.x;
  const dy = wy - p.y;
  const x = dx * Math.cos(a) - dy * Math.sin(a);
  const y = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: p.flip ? -x : x, y };
}

/** Mirror a local primitive when the piece is flipped. */
export function mirrorPrim(prim: Prim, flip: boolean): Prim {
  if (!flip) return prim;
  return prim.k === "rect" ? { ...prim, x: -prim.x, a: -prim.a } : { ...prim, x: -prim.x };
}

/** Is the world point on the piece (with `pad` world units of slack for fingers)? */
export function hitTest(p: Piece, wx: number, wy: number, pad: number) {
  const h = hitShape(p.type);
  const l = toLocal(p, wx, wy);
  const dx = l.x - h.cx;
  const dy = l.y - h.cy;
  if (h.round) return Math.hypot(dx, dy) <= h.hw + pad;
  return Math.abs(dx) <= h.hw + pad && Math.abs(dy) <= h.hh + pad;
}

/** Rotate handle position (world): above the piece, rotating with it. */
export function handlePoint(p: Piece, offset: number): Vec {
  const h = hitShape(p.type);
  return toWorld(p, h.cx, h.cy - h.hh - offset);
}

/** Axis-aligned world bounds of the piece's hit box (for toolbar placement). */
export function worldBounds(p: Piece) {
  const h = hitShape(p.type);
  const corners = [
    [-h.hw, -h.hh],
    [h.hw, -h.hh],
    [h.hw, h.hh],
    [-h.hw, h.hh],
  ].map(([x, y]) => toWorld(p, h.cx + x, h.cy + y));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
