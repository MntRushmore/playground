// One-tap face presets, as plain carving ops you can keep tweaking. Pure.

import type { PaintOp, ShapeId, StampOp, StrokeOp } from "./types";

const s = (shape: ShapeId, x: number, y: number, k: number, f = false): StampOp => ({ t: "stamp", s: shape, x, y, k, f });
/** A left/right pair; the right one is mirrored. */
const pair = (shape: ShapeId, x: number, y: number, k: number): StampOp[] => [s(shape, -x, y, k), s(shape, x, y, k, true)];
const cut = (w: number, ...p: number[]): StrokeOp => ({ t: "cut", w, p });

function lantern(): PaintOp[] {
  const out: PaintOp[] = [];
  const rows = [-0.48, -0.24, 0, 0.24, 0.48];
  rows.forEach((y, r) => {
    const half = Math.sqrt(1 - (y / 0.8) ** 2) * 0.72;
    for (let x = r % 2 ? 0.11 : 0; x <= half; x += 0.22) {
      out.push(r % 2 ? s("diamond", x, y, 0.07) : s("dot", x, y, 0.05));
      if (x > 0.01) out.push(r % 2 ? s("diamond", -x, y, 0.07) : s("dot", -x, y, 0.05));
    }
  });
  return out;
}

export const FACES = {
  jack: {
    label: "Jack",
    ops: [...pair("tri", 0.36, -0.22, 0.21), s("nose", 0, -0.01, 0.11), s("grin", 0, 0.32, 0.44)],
  },
  grin: {
    label: "Grin",
    ops: [...pair("happyEye", 0.36, -0.24, 0.2), s("smile", 0, 0.28, 0.52)],
  },
  fiend: {
    label: "Fiend",
    ops: [...pair("fiendEye", 0.38, -0.2, 0.25), s("fangs", 0, 0.36, 0.5)],
  },
  cat: {
    label: "Cat",
    ops: [
      ...pair("catEye", 0.36, -0.2, 0.2),
      s("catNose", 0, 0.06, 0.07),
      s("catMouth", 0, 0.24, 0.2),
      cut(0.022, -0.24, 0.1, -0.72, 0.0),
      cut(0.022, -0.25, 0.17, -0.74, 0.19),
      cut(0.022, -0.24, 0.24, -0.7, 0.38),
      cut(0.022, 0.24, 0.1, 0.72, 0.0),
      cut(0.022, 0.25, 0.17, 0.74, 0.19),
      cut(0.022, 0.24, 0.24, 0.7, 0.38),
    ],
  },
  ghost: {
    label: "Ghost",
    ops: [s("ghost", 0, 0.06, 0.5), s("star", -0.55, -0.35, 0.07), s("star", 0.6, -0.15, 0.05)],
  },
  stars: {
    label: "Stars",
    ops: [
      s("moon", -0.2, -0.12, 0.34),
      s("star", 0.38, -0.36, 0.1),
      s("star", 0.5, 0.08, 0.08),
      s("star", 0.18, 0.36, 0.11),
      s("star", -0.48, 0.38, 0.07),
      s("dot", 0.62, -0.42, 0.03),
      s("dot", -0.62, -0.1, 0.025),
      s("dot", 0.3, 0.6, 0.025),
    ],
  },
  lantern: { label: "Lantern", ops: lantern() },
} satisfies Record<string, { label: string; ops: PaintOp[] }>;

export const FACE_ORDER = ["jack", "grin", "fiend", "cat", "ghost", "stars", "lantern"] as const;
