// Carvable shapes as polygons in a [-1, 1] box (y down), plus the "hand-chiseled"
// jitter that makes cut edges look knife-made. Pure apart from the Path2D cache.

import { mulberry32 } from "./noise";
import type { Pt, ShapeDef } from "./types";

const TAU = Math.PI * 2;

/** Points along an ellipse (or an arc of one). */
function ellipse(cx: number, cy: number, rx: number, ry: number, n = 20, a0 = 0, a1 = TAU): Pt[] {
  const full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const count = full ? n : n + 1;
  return Array.from({ length: count }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });
}

/** A thick band following a polyline (whisker-free mouths, happy closed eyes). */
function band(line: Pt[], width: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  line.forEach((p, i) => {
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (width / 2);
    const ny = (dx / len) * (width / 2);
    left.push([p[0] + nx, p[1] + ny]);
    right.push([p[0] - nx, p[1] - ny]);
  });
  return [...left, ...right.reverse()];
}

function star(points: number, inner: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : 1;
    const a = -Math.PI / 2 + (Math.PI * i) / points;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
}

/** Crescent: outer circle minus an offset circle, traced as one outline. */
function crescent(): Pt[] {
  const outer = ellipse(0, 0, 1, 1, 24, -Math.PI * 0.62, Math.PI * 0.62);
  const inner = ellipse(0.45, -0.08, 0.82, 0.86, 24, Math.PI * 0.55, -Math.PI * 0.55);
  return [...outer.map(([x, y]) => [-x, y] as Pt), ...inner.map(([x, y]) => [-x, y] as Pt)];
}

const arc = (w: number, h: number, n = 10): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const x = -w + 2 * w * t;
    return [x, h * (1 - 4 * (t - 0.5) ** 2)] as Pt;
  });

export const SHAPES = {
  tri: { outer: [[-0.95, 0.75], [0.95, 0.82], [0.22, -0.92]] },
  nose: { outer: [[0, -0.95], [0.85, 0.75], [-0.85, 0.75]] },
  grin: {
    outer: [
      [-1, -0.5], [-0.72, -0.16], [-0.44, -0.02], [-0.42, 0.3], [-0.17, 0.36], [-0.15, 0.06],
      [0, 0.09], [0.15, 0.06], [0.17, 0.36], [0.42, 0.3], [0.44, -0.02], [0.72, -0.16],
      [1, -0.5], [0.85, 0.25], [0.55, 0.68], [0.2, 0.88], [-0.2, 0.88], [-0.55, 0.68], [-0.85, 0.25],
    ],
  },
  fiendEye: {
    outer: [
      [-1, -0.62], [-0.35, -0.22], [-0.05, -0.62], [0.2, -0.12], [1, 0.12], [0.62, 0.72],
      [-0.12, 0.66], [-0.72, 0.2],
    ],
  },
  fangs: {
    outer: [
      [-1, -0.45], [-0.75, -0.15], [-0.6, 0.32], [-0.45, -0.05], [-0.2, 0.02], [0, 0.22],
      [0.2, 0.02], [0.45, -0.05], [0.6, 0.32], [0.75, -0.15], [1, -0.45], [0.8, 0.2],
      [0.55, 0.58], [0.4, 0.3], [0.2, 0.72], [0, 0.45], [-0.2, 0.72], [-0.4, 0.3],
      [-0.55, 0.58], [-0.8, 0.2],
    ],
  },
  happyEye: { outer: band(arc(0.9, -0.55).map(([x, y]) => [x, y + 0.2] as Pt), 0.42) },
  smile: { outer: band(arc(1, 0.55).map(([x, y]) => [x, y - 0.25] as Pt), 0.5) },
  catEye: {
    outer: [...ellipse(0, 0, 1, 0.62, 12, Math.PI, TAU), ...ellipse(0, 0, 1, 0.62, 12, 0, Math.PI)]
      .map(([x, y]) => [x, y * (1 - 0.35 * Math.abs(x))] as Pt),
    holes: [ellipse(0.05, 0, 0.12, 0.5, 14)],
  },
  catNose: { outer: [[-0.9, -0.6], [0.9, -0.6], [0, 0.8]] },
  catMouth: { outer: band([[-0.95, -0.2], [-0.48, 0.38], [0, -0.05], [0.48, 0.38], [0.95, -0.2]], 0.26) },
  ghost: {
    outer: [
      ...ellipse(0, -0.25, 0.72, 0.72, 18, Math.PI, TAU),
      [0.74, 0.85], [0.5, 0.65], [0.25, 0.88], [0, 0.66], [-0.25, 0.88], [-0.5, 0.65], [-0.74, 0.85],
    ],
    holes: [ellipse(-0.26, -0.3, 0.12, 0.17, 12), ellipse(0.26, -0.3, 0.12, 0.17, 12), ellipse(0, 0.08, 0.14, 0.2, 12)],
  },
  moon: { outer: crescent() },
  star: { outer: star(5, 0.45) },
  dot: { outer: ellipse(0, 0, 1, 1, 14) },
  diamond: { outer: [[0, -1], [0.62, 0], [0, 1], [-0.62, 0]] },
} satisfies Record<string, ShapeDef>;

type ShapeKey = keyof typeof SHAPES;

/**
 * Hand-chiseled outline: edges are split into short facets whose points wander a
 * little across the edge, like a knife working around the shape. Corners stay sharp.
 */
export function chisel(points: Pt[], seed: number, amount = 0.05, step = 0.16): Pt[] {
  const rand = mulberry32(seed);
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push(a);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const n = Math.floor(len / step);
    for (let j = 1; j < n; j++) {
      const t = (j + (rand() - 0.5) * 0.5) / n;
      const off = (rand() - 0.5) * 2 * amount;
      out.push([a[0] + dx * t - (dy / len) * off, a[1] + dy * t + (dx / len) * off]);
    }
  }
  return out;
}

const toPath = (pts: Pt[]) => {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
};

const cache = new Map<string, { outer: Path2D; holes: Path2D[] }>();

/** Chiseled Path2D for a shape; the jitter is seeded so replays are identical. */
export function shapePaths(id: ShapeKey, seed: number) {
  const key = `${id}:${seed}`;
  let hit = cache.get(key);
  if (!hit) {
    const def: ShapeDef = SHAPES[id];
    hit = {
      outer: toPath(chisel(def.outer, seed)),
      holes: (def.holes ?? []).map((h, i) => toPath(chisel(h, seed + i + 1, 0.03, 0.12))),
    };
    if (cache.size > 400) cache.clear();
    cache.set(key, hit);
  }
  return hit;
}

/** SVG path data for previews (clean, unchiseled). */
export function shapeSvg(id: ShapeKey) {
  const def: ShapeDef = SHAPES[id];
  const d = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L")}Z`;
  return [d(def.outer), ...(def.holes ?? []).map(d)].join(" ");
}
