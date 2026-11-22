// Layout logic: validation of stored layouts, snapping, board fitting. Pure.

import { ANGLE_SNAP, CONNECT_RADIUS, GRID, LAYOUT_VERSION, MAX_PIECES, PIECE_TYPES, WORLD } from "./data";
import { connectors } from "./geometry";
import { toWorld } from "./transforms";
import type { Piece, PieceType, StoredLayout, Vec, View } from "./types";

let counter = 0;
export function newId() {
  counter = (counter + 1) % 1e6;
  return `p${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function clampToBoard(x: number, y: number): Vec {
  return { x: Math.min(WORLD.width, Math.max(0, x)), y: Math.min(WORLD.height, Math.max(0, y)) };
}

export function normalizeAngle(deg: number) {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

export function snapAngle(deg: number) {
  return normalizeAngle(Math.round(deg / ANGLE_SNAP) * ANGLE_SNAP);
}

export function snapToGrid(v: Vec): Vec {
  return { x: Math.round(v.x / GRID) * GRID, y: Math.round(v.y / GRID) * GRID };
}

/**
 * Track-end snapping: if one of this piece's connectors lands near another piece's connector,
 * shift the piece so the ends meet, the receiving end a touch lower for a clean hand-off.
 */
export function snapToConnectors(p: Piece, others: readonly Piece[]): Vec | null {
  const mine = connectors(p.type).map((c) => toWorld(p, c.x, c.y));
  if (!mine.length) return null;
  let best: { d: number; dx: number; dy: number } | null = null;
  for (const o of others) {
    if (o.id === p.id) continue;
    for (const oc of connectors(o.type)) {
      const t = toWorld(o, oc.x, oc.y);
      for (const c of mine) {
        const d = Math.hypot(t.x - c.x, t.y - c.y);
        if (d < CONNECT_RADIUS && (!best || d < best.d)) {
          // Whoever's end is lower receives: nudge so there's a small, clean step down.
          const step = c.y > t.y ? 3 : -3;
          best = { d, dx: t.x - c.x, dy: t.y - c.y + step };
        }
      }
    }
  }
  return best ? { x: p.x + best.dx, y: p.y + best.dy } : null;
}

const TYPES = new Set<string>(PIECE_TYPES);

/** Validates an untrusted stored layout. Returns null if unusable (caller falls back to default). */
export function sanitizeLayout(input: unknown): Piece[] | null {
  if (!input || typeof input !== "object") return null;
  const { version, pieces } = input as Partial<StoredLayout>;
  if (version !== LAYOUT_VERSION || !Array.isArray(pieces)) return null;
  const out: Piece[] = [];
  const ids = new Set<string>();
  for (const raw of pieces.slice(0, MAX_PIECES)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Partial<Piece>;
    if (typeof p.type !== "string" || !TYPES.has(p.type)) continue;
    if (![p.x, p.y, p.angle].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    let id = typeof p.id === "string" && p.id.length > 0 && p.id.length < 40 ? p.id : newId();
    if (ids.has(id)) id = newId();
    ids.add(id);
    const pos = clampToBoard(p.x as number, p.y as number);
    out.push({
      id,
      type: p.type as PieceType,
      x: pos.x,
      y: pos.y,
      angle: normalizeAngle(p.angle as number),
      flip: p.flip === true,
    });
  }
  return out;
}

export function toStored(pieces: readonly Piece[]): StoredLayout {
  return { version: LAYOUT_VERSION, pieces: [...pieces] };
}

/**
 * Fits the board into the container, avoiding an overlay (the piece tray).
 * A tall overlay on the left reserves a column; a wide one at the bottom reserves a band.
 */
export function fitView(width: number, height: number, tray: DOMRectReadOnly | null, origin: Vec): View {
  const gap = 12;
  let left = gap;
  let bottom = gap;
  // Extra headroom: funnel cups and column tops stand a little above the board.
  const top = gap + 14;
  const right = gap;
  if (tray && tray.width > 0) {
    const tx = tray.left - origin.x;
    const ty = tray.top - origin.y;
    if (tray.height > tray.width) left = tx + tray.width + gap;
    else bottom = height - ty + gap;
  }
  const aw = Math.max(40, width - left - right);
  const ah = Math.max(40, height - top - bottom);
  const scale = Math.min(aw / WORLD.width, ah / WORLD.height);
  const ox = left + (aw - WORLD.width * scale) / 2;
  // Stand the structure on the bottom edge (just above the tray), like a kit on a table.
  const oy = top + (ah - WORLD.height * scale);
  return { scale, ox, oy, width, height };
}

export function worldToScreen(v: View, x: number, y: number): Vec {
  return { x: x * v.scale + v.ox, y: y * v.scale + v.oy };
}

export function screenToWorld(v: View, x: number, y: number): Vec {
  return { x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale };
}

export function insideBoard(x: number, y: number, margin = 0) {
  return x >= -margin && y >= -margin && x <= WORLD.width + margin && y <= WORLD.height + margin;
}
