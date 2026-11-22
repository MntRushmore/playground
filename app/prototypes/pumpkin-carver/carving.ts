// Carving ops → pixels, plus stroke helpers. No React; canvas contexts come in as args.

import { STAMPS } from "./data";
import type { Op, StampDef, StampId, StampOp, StrokeOp } from "./types";

/** Ops after the most recent clear: the carving that's actually visible. */
export function visibleOps(ops: readonly Op[]): (StrokeOp | StampOp)[] {
  let start = 0;
  for (let i = ops.length - 1; i >= 0; i--) {
    if (ops[i].t === "clear") {
      start = i + 1;
      break;
    }
  }
  return ops.slice(start).filter((op): op is StrokeOp | StampOp => op.t !== "clear");
}

const isHanded = (id: StampId) => (STAMPS[id] as StampDef).handed === true;

const pathCache = new Map<StampId, Path2D>();
export function stampPath(id: StampId) {
  let p = pathCache.get(id);
  if (!p) {
    p = new Path2D(STAMPS[id].path);
    pathCache.set(id, p);
  }
  return p;
}

/** Smooth path through the points: quadratic curves between midpoints. */
export function traceStroke(ctx: CanvasRenderingContext2D, p: readonly number[]) {
  ctx.beginPath();
  const n = p.length / 2;
  ctx.moveTo(p[0], p[1]);
  if (n === 1) {
    ctx.lineTo(p[0] + 1e-4, p[1]);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const x = p[i * 2];
    const y = p[i * 2 + 1];
    ctx.quadraticCurveTo(x, y, (x + p[i * 2 + 2]) / 2, (y + p[i * 2 + 3]) / 2);
  }
  ctx.lineTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
}

/** Draws a stroke in face units (the face transform must already be set). */
export function drawStroke(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  if (op.p.length < 2) return;
  ctx.lineWidth = op.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  traceStroke(ctx, op.p);
  ctx.stroke();
  if (op.m) {
    ctx.save();
    ctx.scale(-1, 1);
    traceStroke(ctx, op.p);
    ctx.stroke();
    ctx.restore();
  }
}

function placeStamp(ctx: CanvasRenderingContext2D, id: StampId, x: number, y: number, k: number) {
  const flip = isHanded(id) && x > 0.001;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  ctx.fill(stampPath(id));
  ctx.restore();
}

/** Mirrored copies only make sense away from the center line. */
export const mirrors = (op: { m?: boolean; x: number }) => op.m && Math.abs(op.x) > 0.03;

export function drawStamp(ctx: CanvasRenderingContext2D, op: StampOp) {
  placeStamp(ctx, op.s, op.x, op.y, op.k);
  if (mirrors(op)) placeStamp(ctx, op.s, -op.x, op.y, op.k);
}

/** Outline of a stamp (and its mirror) for the placement preview. */
export function outlineStamp(ctx: CanvasRenderingContext2D, op: StampOp) {
  const one = (x: number) => {
    const flip = isHanded(op.s) && x > 0.001;
    ctx.save();
    ctx.translate(x, op.y);
    ctx.scale(flip ? -op.k : op.k, op.k);
    ctx.stroke(stampPath(op.s));
    ctx.restore();
  };
  one(op.x);
  if (mirrors(op)) one(-op.x);
}

/** Replays ops of one kind (cuts + stamps, or etches) into a mask, white on transparent. */
export function paintOps(ctx: CanvasRenderingContext2D, ops: readonly (StrokeOp | StampOp)[], kind: "cut" | "etch") {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  for (const op of ops) {
    if (op.t === "stamp") {
      if (kind === "cut") drawStamp(ctx, op);
    } else if (op.t === kind) {
      drawStroke(ctx, op);
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
