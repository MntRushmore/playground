// Support columns: every piece is held up by a stacked tube column standing on the floor,
// like a real kit. Columns are generated from the layout (decorative, no physics). Pure.

import { WORLD } from "./data";
import { FUNNEL, RAMP_LENGTH, curveArc } from "./geometry";
import { toWorld } from "./transforms";
import type { Piece, Vec } from "./types";

export type Post = { x: number; top: number; seed: number };

export const FLOOR = WORLD.height + 6;
export const POST_W = 30;
const MERGE = 36;

/** Where a piece clips onto its column (local frame), or null if it needs none. */
function anchor(p: Piece): Vec | null {
  switch (p.type) {
    case "ramp": {
      // Mount the higher end, a little inboard, so marbles leave the low end freely.
      const a = toWorld(p, -RAMP_LENGTH / 2 + 26, 0);
      const b = toWorld(p, RAMP_LENGTH / 2 - 26, 0);
      return a.y <= b.y ? a : b;
    }
    case "curve": {
      const c = curveArc();
      const k = Math.PI / 4;
      return toWorld(p, c.cx + Math.cos(k) * (c.r + 10), c.cy + Math.sin(k) * (c.r + 10));
    }
    case "funnel":
      return toWorld(p, 0, FUNNEL.neckY + FUNNEL.spout);
    case "wheel":
    case "switch":
    case "bumper":
      return toWorld(p, 0, 0);
    case "spring":
      return toWorld(p, 0, 26);
    case "cup":
      return toWorld(p, 0, 52);
    default:
      return null;
  }
}

export function computePosts(pieces: readonly Piece[]): Post[] {
  const anchors = pieces
    .map((p) => ({ a: anchor(p), id: p.id }))
    .filter((x): x is { a: Vec; id: string } => x.a !== null && x.a.y < FLOOR - 30)
    .sort((m, n) => m.a.y - n.a.y);
  const posts: Post[] = [];
  for (const { a, id } of anchors) {
    if (posts.some((p) => Math.abs(p.x - a.x) < MERGE && p.top <= a.y)) continue;
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i);
    posts.push({ x: a.x, top: a.y, seed });
  }
  return posts;
}
