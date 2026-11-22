// What's under a point: selected bar's knobs, then the nearest bar, then emitters. Pure.

import { GEOMETRY } from "./data";
import { barEnds, distToSegment, knobPositions, toPxX } from "./geometry";
import type { Target } from "./gestures";
import type { BarGeom, Emitter, Size } from "./types";

/** Knobs are 24px circles with a 44px touch target. */
const KNOB_REACH = 22;
const EMITTER_REACH = 24;

export function hitTest(
  x: number,
  y: number,
  geoms: Map<string, BarGeom>,
  selected: string | null,
  emitters: Emitter[],
  size: Size
): Target {
  const selectedGeom = selected ? geoms.get(selected) : undefined;
  if (selected && selectedGeom) {
    const k = knobPositions(selectedGeom, size);
    if (Math.hypot(x - k.rotate.x, y - k.rotate.y) <= KNOB_REACH) return { kind: "rotate", id: selected };
    if (Math.hypot(x - k.remove.x, y - k.remove.y) <= KNOB_REACH) return { kind: "remove", id: selected };
  }
  let best: { id: string; d: number } | null = null;
  for (const [id, g] of geoms) {
    const e = barEnds(g);
    const d = distToSegment(x, y, e.ax, e.ay, e.bx, e.by) - g.thickness / 2;
    if (d <= GEOMETRY.hitSlop && (!best || d < best.d)) best = { id, d };
  }
  if (best) return { kind: "bar", id: best.id };
  for (let i = 0; i < emitters.length; i++) {
    const em = emitters[i];
    if (Math.hypot(x - toPxX(em.x, size), y - em.y * size.height) <= EMITTER_REACH) return { kind: "emitter", index: i };
  }
  return { kind: "empty" };
}
