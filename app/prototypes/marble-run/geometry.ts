// Piece shapes in their local frame. Shared by physics (bodies) and rendering, so what you
// see is exactly what the marbles collide with. Pure: no DOM, no Matter.

import { TRACK } from "./data";
import type { PieceType, Prim, Vec } from "./types";

const DEG = Math.PI / 180;

export const RAMP_LENGTH = 300;
export const CURVE_RADIUS = 130;
export const CURVE_SEGMENTS = 14;
/** Vortex funnel: a cone seen slightly from above. `rim`/`neck` are half-widths at those heights. */
export const FUNNEL = { rim: 150, rimY: -52, neck: 27, neckY: 38, spout: 40, tilt: 0.24 } as const;
export const BUMPER_RADIUS = 28;
export const WHEEL = { hub: 16, reach: 86, paddles: 6, speed: 1.5 } as const;
export const SWITCH = { length: 150, tilt: 22 * DEG, flipMs: 150 } as const;
const LIFT_HEIGHT = 1000;
export const LIFT = {
  height: LIFT_HEIGHT,
  railX: 36,
  cleatX: -2,
  cleatW: 58,
  cleatTilt: 12 * DEG,
  dumpTilt: -40 * DEG,
  /** Belt travel: rise from below the basin to the top, tip over, then return hidden. */
  start: LIFT_HEIGHT / 2 + 30,
  top: -LIFT_HEIGHT / 2 + 38,
  tip: 60,
  /** Belt travel the cleat holds its tipped pose so the marble has time to roll off. */
  dwell: 90,
  cycle: LIFT_HEIGHT + 30 - 38 + 60 + 90 + 150,
  cleats: 12,
  speed: 230,
} as const;

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number, tag?: string) {
  const out: Prim[] = [];
  const step = (a1 - a0) / n;
  // Slight overlap between segments keeps the inner surface free of seams.
  const len = Math.abs(step) * r + TRACK * 0.55;
  for (let i = 0; i < n; i++) {
    const a = a0 + step * (i + 0.5);
    out.push({ k: "rect", x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, w: len, h: TRACK, a: a + Math.PI / 2, tag });
  }
  return out;
}

export function curveArc() {
  const c = -CURVE_RADIUS / 2;
  return { cx: c, cy: c, r: CURVE_RADIUS, a0: 0, a1: Math.PI / 2 };
}

/** Height (local y) of the cone surface at radius r. */
export function funnelY(r: number) {
  const { rim, rimY, neck, neckY } = FUNNEL;
  return rimY + ((rim - r) / (rim - neck)) * (neckY - rimY);
}

/** A straight wall between two local points. */
function wall(x0: number, y0: number, x1: number, y1: number, h = TRACK): Prim {
  return { k: "rect", x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: Math.hypot(x1 - x0, y1 - y0), h, a: Math.atan2(y1 - y0, x1 - x0) };
}

/** Lift cleat pose at belt position `s` (0..cycle). `null` while on the hidden return run. */
export function cleatPose(s: number): { x: number; y: number; a: number } | null {
  const { start, top, tip, dwell, cleatX, cleatTilt, dumpTilt } = LIFT;
  const rise = start - top;
  if (s <= rise) return { x: cleatX, y: start - s, a: cleatTilt };
  if (s <= rise + tip + dwell) {
    // Decelerate gently (slower than gravity, so the marble stays seated), tip, then hold.
    const t = Math.min(1, (s - rise) / tip);
    const e = t * t * (3 - 2 * t);
    const lift = (tip / 2) * (1 - (1 - t) * (1 - t));
    return { x: cleatX - e * 8, y: top - lift, a: cleatTilt + (dumpTilt - cleatTilt) * e };
  }
  return null;
}

/** Static collision shapes (moving parts such as wheels, switch planks and cleats included at rest). */
export function localPrims(type: PieceType): Prim[] {
  switch (type) {
    case "ramp":
      return [{ k: "rect", x: 0, y: 0, w: RAMP_LENGTH, h: TRACK, a: 0 }];
    case "curve": {
      const c = curveArc();
      return arc(c.cx, c.cy, c.r, c.a0, c.a1, CURVE_SEGMENTS);
    }
    case "funnel": {
      // Collision walls are the cone's silhouette; upright funnels also spin marbles (vortex.ts).
      const { rim, rimY, neck, neckY, spout } = FUNNEL;
      const n = neck + TRACK / 2;
      return [
        wall(-rim, rimY, -n, neckY),
        wall(rim, rimY, n, neckY),
        wall(-n, neckY, -n, neckY + spout, TRACK * 0.8),
        wall(n, neckY, n, neckY + spout, TRACK * 0.8),
      ];
    }
    case "bumper":
      return [{ k: "circle", x: 0, y: 0, r: BUMPER_RADIUS }];
    case "spring":
      return [
        { k: "rect", x: 0, y: -16, w: 92, h: 12, a: 0, tag: "pad" },
        { k: "rect", x: 0, y: 24, w: 66, h: 10, a: 0 },
      ];
    case "wheel": {
      const out: Prim[] = [{ k: "circle", x: 0, y: 0, r: WHEEL.hub }];
      const len = WHEEL.reach - 8;
      for (let i = 0; i < WHEEL.paddles; i++) {
        const a = (i / WHEEL.paddles) * Math.PI * 2;
        const d = 8 + len / 2;
        out.push({ k: "rect", x: Math.cos(a) * d, y: Math.sin(a) * d, w: len, h: 10, a });
      }
      return out;
    }
    case "switch":
      return [{ k: "rect", x: 0, y: 0, w: SWITCH.length, h: 12, a: 0 }];
    case "lift": {
      const { height, railX } = LIFT;
      const bottom = height / 2;
      // The rail runs past the belt's top so marbles stay held until the cleat tips them out.
      const railTop = -height / 2 - 64;
      return [
        { k: "rect", x: railX, y: (railTop + bottom) / 2, w: 12, h: bottom - railTop, a: 0, tag: "rail" },
        { k: "rect", x: -14, y: bottom, w: 112, h: 12, a: 8 * DEG },
        { k: "rect", x: -73, y: bottom - 16, w: 10, h: 34, a: 0 },
        // Exit chute reaches under the tipping cleat; static cleats pass through it.
        { k: "rect", x: -76, y: -height / 2 + 72, w: 104, h: 12, a: -14 * DEG },
      ];
    }
    case "cup":
      return [
        { k: "rect", x: -64, y: 0, w: 12, h: 92, a: -6 * DEG },
        { k: "rect", x: 64, y: 0, w: 12, h: 92, a: 6 * DEG },
        { k: "rect", x: 0, y: 46, w: 140, h: 12, a: 0 },
      ];
    case "dropper":
      return [];
  }
}

/** The cup's inner sensor, local frame. */
export const CUP_SENSOR = { x: 0, y: 12, w: 100, h: 58 } as const;
/** Where a dropper releases marbles, local frame. */
export const DROPPER_MOUTH = { x: 0, y: 44 } as const;

/** Track ends that click together when dragged close. Local frame. */
export function connectors(type: PieceType): Vec[] {
  switch (type) {
    case "ramp":
      return [
        { x: -RAMP_LENGTH / 2, y: 0 },
        { x: RAMP_LENGTH / 2, y: 0 },
      ];
    case "curve": {
      const c = curveArc();
      return [
        { x: c.cx + c.r, y: c.cy },
        { x: c.cx, y: c.cy + c.r },
      ];
    }
    case "lift":
      return [
        { x: -84, y: LIFT.height / 2 - 40 },
        { x: -130, y: -LIFT.height / 2 + 85 },
      ];
    case "switch":
      return [
        { x: -SWITCH.length / 2, y: 0 },
        { x: SWITCH.length / 2, y: 0 },
      ];
    default:
      return [];
  }
}

/** Mount pegs drawn where a piece "screws" into the pegboard. Local frame. */
export function pegs(type: PieceType): Vec[] {
  switch (type) {
    case "ramp":
      return [
        { x: -RAMP_LENGTH / 2 + 34, y: 0 },
        { x: RAMP_LENGTH / 2 - 34, y: 0 },
      ];
    case "curve": {
      const c = curveArc();
      const a = Math.PI / 4;
      return [{ x: c.cx + Math.cos(a) * c.r, y: c.cy + Math.sin(a) * c.r }];
    }
    case "funnel":
      return [{ x: 0, y: FUNNEL.neckY + FUNNEL.spout - 6 }];
    case "cup":
      return [{ x: 0, y: 46 }];
    case "spring":
      return [{ x: 0, y: 24 }];
    default:
      return [];
  }
}

/** Hit area: oriented box (local centre + half extents) or circle. */
export function hitShape(type: PieceType): { cx: number; cy: number; hw: number; hh: number; round?: boolean } {
  switch (type) {
    case "ramp":
      return { cx: 0, cy: 0, hw: RAMP_LENGTH / 2, hh: TRACK / 2 };
    case "curve":
      return { cx: 0, cy: 0, hw: 72, hh: 72 };
    case "funnel":
      return { cx: 0, cy: 0, hw: FUNNEL.rim + 8, hh: 72 };
    case "bumper":
      return { cx: 0, cy: 0, hw: BUMPER_RADIUS, hh: BUMPER_RADIUS, round: true };
    case "spring":
      return { cx: 0, cy: 4, hw: 48, hh: 28 };
    case "wheel":
      return { cx: 0, cy: 0, hw: WHEEL.reach, hh: WHEEL.reach, round: true };
    case "switch":
      return { cx: 0, cy: 6, hw: SWITCH.length / 2, hh: 24 };
    case "lift":
      return { cx: -44, cy: 0, hw: 92, hh: LIFT.height / 2 + 8 };
    case "cup":
      return { cx: 0, cy: 4, hw: 72, hh: 50 };
    case "dropper":
      return { cx: 0, cy: 6, hw: 30, hh: 44 };
  }
}
