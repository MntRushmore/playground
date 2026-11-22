// Hand-drawn canvas primitives: wobbly blobs and bowed lines so every unit looks
// inked by hand. All pure 2D-canvas drawing; the caller sets fill/stroke styles.

const TAU = Math.PI * 2;

/** Deterministic pseudo-random in [0, 1) from a scalar. */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Trace a slightly irregular closed blob. Caller fills/strokes the current path.
 *  `phase` animates the wobble (pass a constant for a still, reduced-motion shape). */
export function blobPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  jitter: number,
  seed: number,
  phase: number,
  points = 11
) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const wob = Math.sin(phase + i * 1.7 + seed) * jitter;
    const jr = r * (1 + wob + (hash(seed + i) - 0.5) * jitter * 0.6);
    const x = cx + Math.cos(a) * jr;
    const y = cy + Math.sin(a) * jr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** A single bowed stroke from (x1,y1) to (x2,y2). Added to the current path. */
export function roughLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow: number,
  seed: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = (hash(seed) - 0.5) * 2 * bow;
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2 + nx * off, (y1 + y2) / 2 + ny * off, x2, y2);
}

/** An arc (for bows, brows), added to the current path. */
export function roughArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  from: number,
  to: number
) {
  ctx.moveTo(cx + Math.cos(from) * r, cy + Math.sin(from) * r);
  ctx.arc(cx, cy, r, from, to);
}

export { hash };
