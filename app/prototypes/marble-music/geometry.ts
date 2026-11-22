// Layout ↔ pixel geometry and hit-testing math. Pure.

import { DEGREE_COUNT, GEOMETRY } from "./data";
import type { Bar, BarGeom, Size } from "./types";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Shorter canvas side: every size in the machine scales from it. */
export const unitOf = (size: Size) => Math.max(1, Math.min(size.width, size.height));

/** The centered region layouts are normalized to (full height, width capped by aspect). */
export function stageOf(size: Size) {
  const width = Math.min(size.width, size.height * GEOMETRY.stageAspect);
  return { x: (size.width - width) / 2, width, height: size.height };
}

/** Normalized stage x → canvas px. */
export const toPxX = (nx: number, size: Size) => {
  const st = stageOf(size);
  return st.x + nx * st.width;
};

/** Canvas px → normalized stage x. */
export const toNormX = (px: number, size: Size) => {
  const st = stageOf(size);
  return (px - st.x) / Math.max(1, st.width);
};

/** Bar length in px for a degree: geometric, like real xylophone bars (short = high). */
export function lengthForDegree(degree: number, size: Size) {
  const t = clamp(degree, 0, DEGREE_COUNT - 1) / (DEGREE_COUNT - 1);
  const ratio = GEOMETRY.minLength / GEOMETRY.maxLength;
  return unitOf(size) * GEOMETRY.maxLength * Math.pow(ratio, t);
}

/** Nearest degree for a desired length in px (inverse of lengthForDegree). */
export function degreeForLength(length: number, size: Size) {
  const max = unitOf(size) * GEOMETRY.maxLength;
  const ratio = GEOMETRY.minLength / GEOMETRY.maxLength;
  const t = Math.log(Math.max(1, length) / max) / Math.log(ratio);
  return clamp(Math.round(t * (DEGREE_COUNT - 1)), 0, DEGREE_COUNT - 1);
}

export function barThickness(size: Size) {
  return clamp(unitOf(size) * GEOMETRY.thickness, GEOMETRY.minThickness, GEOMETRY.maxThickness);
}

export function marbleRadius(size: Size, scale: number) {
  return clamp(unitOf(size) * GEOMETRY.marbleRadius, GEOMETRY.minMarble, GEOMETRY.maxMarble) * scale;
}

export function barGeom(bar: Bar, size: Size): BarGeom {
  return {
    cx: toPxX(bar.x, size),
    cy: bar.y * size.height,
    angle: bar.angle,
    length: lengthForDegree(bar.degree, size),
    thickness: barThickness(size),
  };
}

export function barEnds(g: BarGeom, scale = 1) {
  const half = (g.length / 2) * scale;
  const ux = Math.cos(g.angle);
  const uy = Math.sin(g.angle);
  return {
    ax: g.cx - ux * half,
    ay: g.cy - uy * half,
    bx: g.cx + ux * half,
    by: g.cy + uy * half,
    ux,
    uy,
  };
}

/**
 * Rotate knob sits past the bar's "b" end, delete knob past the "a" end; both are kept
 * on screen so a bar parked at the edge can still be turned or removed.
 */
export function knobPositions(g: BarGeom, size: Size) {
  const e = barEnds(g);
  const off = GEOMETRY.knobGap + GEOMETRY.knobRadius * 0.4;
  const m = GEOMETRY.knobRadius + 3;
  const keep = (x: number, y: number) => ({
    x: clamp(x, m, size.width - m),
    y: clamp(y, m, size.height - m),
  });
  return {
    rotate: keep(e.bx + e.ux * off, e.by + e.uy * off),
    remove: keep(e.ax - e.ux * off, e.ay - e.uy * off),
  };
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentsCross(
  a: [number, number, number, number],
  b: [number, number, number, number]
) {
  const cross = (ox: number, oy: number, px: number, py: number, qx: number, qy: number) =>
    (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
  const d1 = cross(b[0], b[1], b[2], b[3], a[0], a[1]);
  const d2 = cross(b[0], b[1], b[2], b[3], a[2], a[3]);
  const d3 = cross(a[0], a[1], a[2], a[3], b[0], b[1]);
  const d4 = cross(a[0], a[1], a[2], a[3], b[2], b[3]);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Minimum distance between two bars' center lines (0 if they cross). */
export function barDistance(g1: BarGeom, g2: BarGeom) {
  const a = barEnds(g1);
  const b = barEnds(g2);
  const sa: [number, number, number, number] = [a.ax, a.ay, a.bx, a.by];
  const sb: [number, number, number, number] = [b.ax, b.ay, b.bx, b.by];
  if (segmentsCross(sa, sb)) return 0;
  return Math.min(
    distToSegment(a.ax, a.ay, ...sb),
    distToSegment(a.bx, a.by, ...sb),
    distToSegment(b.ax, b.ay, ...sa),
    distToSegment(b.bx, b.by, ...sa)
  );
}

/** Snap to multiples of 15° when within ~3°, so tidy angles are easy to hit. */
export function snapAngle(angle: number) {
  const step = Math.PI / 12;
  const nearest = Math.round(angle / step) * step;
  return Math.abs(angle - nearest) < 0.05 ? nearest : angle;
}
