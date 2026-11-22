// Carving ops → pixels, plus stroke helpers. No React; canvas contexts come in as args.

import { FACES } from "./faces";
import { shapePaths } from "./shapes";
import type { Op, PaintOp, StampOp, StrokeOp } from "./types";

/** What's actually on the pumpkin: ops after the last clear, with faces expanded. */
export function visibleOps(ops: readonly Op[]): PaintOp[] {
  let out: PaintOp[] = [];
  for (const op of ops) {
    if (op.t === "clear") out = [];
    else if (op.t === "face") out = [...FACES[op.f].ops];
    else out.push(op);
  }
  return out;
}

/** Stable small hash for seeding a shape's chisel marks from where it sits. */
const seedOf = (op: StampOp) =>
  (Math.round(op.x * 1000) * 73856093) ^ (Math.round(op.y * 1000) * 19349663) ^ op.s.length * 83492791;

/** Deterministic 0–1 noise per stroke segment (stable while a stroke grows). */
const hash01 = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A knife stroke: short segments whose width wavers, so the edge looks cut by hand
 * rather than drawn with a marker. Round caps keep the joins solid.
 */
function traceKnife(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  const p = op.p;
  const n = p.length / 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (n === 1) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], op.w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const salt = Math.round((p[0] + p[1]) * 1000);
  const wobble = op.t === "cut" ? 0.38 : 0.2;
  for (let i = 0; i < n - 1; i++) {
    ctx.lineWidth = op.w * (1 - wobble / 2 + wobble * hash01(i, salt));
    ctx.beginPath();
    ctx.moveTo(p[i * 2], p[i * 2 + 1]);
    ctx.lineTo(p[i * 2 + 2], p[i * 2 + 3]);
    ctx.stroke();
  }
}

export function drawStamp(ctx: CanvasRenderingContext2D, op: StampOp) {
  const paths = shapePaths(op.s, seedOf(op));
  ctx.save();
  ctx.translate(op.x, op.y);
  ctx.scale(op.f ? -op.k : op.k, op.k);
  ctx.fill(paths.outer);
  if (paths.holes.length) {
    ctx.globalCompositeOperation = "destination-out";
    for (const h of paths.holes) ctx.fill(h);
  }
  ctx.restore();
}

/**
 * Replays ops into a mask (white on transparent). Cuts and stamps go into the cut mask,
 * etches into the etch mask, and patches erase from both.
 */
export function paintOps(ctx: CanvasRenderingContext2D, ops: readonly PaintOp[], kind: "cut" | "etch") {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  for (const op of ops) {
    if (op.t === "stamp") {
      if (kind === "cut") drawStamp(ctx, op);
    } else if (op.t === "patch") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      traceKnife(ctx, op);
      ctx.restore();
    } else if (op.t === kind) {
      traceKnife(ctx, op);
    }
  }
}

/** Ramer–Douglas–Peucker on a flat [x, y, …] array. Keeps first and last points. */
export function simplify(p: readonly number[], eps: number): number[] {
  const n = p.length / 2;
  if (n <= 2) return p.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const ax = p[s * 2], ay = p[s * 2 + 1];
    const dx = p[e * 2] - ax, dy = p[e * 2 + 1] - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let bestD = eps;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((p[i * 2] - ax) * dy - (p[i * 2 + 1] - ay) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([s, best], [best, e]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

/** Rounds coordinates for compact storage. */
export const quantize = (p: readonly number[], digits = 3) => {
  const f = 10 ** digits;
  return p.map((v) => Math.round(v * f) / f);
};
