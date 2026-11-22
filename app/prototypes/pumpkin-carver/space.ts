// Coordinate spaces. Pure.
//
//   face  : world units on the round pumpkin, origin at the body center, y down.
//           Carving ops live here, so they survive resizes and stretch with the shape.
//   plate : device px of the square pumpkin render (size P), shared by every layer.
//   screen: device px of the visible canvas; the plate is drawn into `PlateRect`.

import { PLATE, ROUND_DIMS } from "./data";
import { bodyDims } from "./geometry";
import type { PumpkinShape, StrokeOp } from "./types";

export type FaceTransform = {
  /** Plate px per face unit, x and y (differs from each other on tall/squat). */
  kx: number;
  ky: number;
  /** Plate px of the face origin. */
  ox: number;
  oy: number;
  size: number;
};

export type PlateRect = { x: number; y: number; size: number };

export function faceTransform(shape: PumpkinShape, size: number): FaceTransform {
  const { a, b } = bodyDims(shape);
  const k = size / (2 * PLATE.E);
  return {
    kx: k * (a / ROUND_DIMS.a),
    ky: k * (b / ROUND_DIMS.b),
    ox: size / 2,
    oy: (PLATE.E + PLATE.OY) * k,
    size,
  };
}

/** Sets ctx so drawing in face units lands on the plate (optionally scaled into a rect). */
export function setFaceTransform(ctx: CanvasRenderingContext2D, ft: FaceTransform, rect?: PlateRect) {
  const s = rect ? rect.size / ft.size : 1;
  const x = rect ? rect.x : 0;
  const y = rect ? rect.y : 0;
  ctx.setTransform(ft.kx * s, 0, 0, ft.ky * s, x + ft.ox * s, y + ft.oy * s);
}

export function faceToPlate(ft: FaceTransform, fx: number, fy: number): [number, number] {
  return [ft.ox + fx * ft.kx, ft.oy + fy * ft.ky];
}

/** Screen (device px) → face units. */
export function screenToFace(ft: FaceTransform, rect: PlateRect, sx: number, sy: number): [number, number] {
  const px = ((sx - rect.x) / rect.size) * ft.size;
  const py = ((sy - rect.y) / rect.size) * ft.size;
  return [(px - ft.ox) / ft.kx, (py - ft.oy) / ft.ky];
}

/**
 * Where the pumpkin sits in the canvas: centered, clear of the toolbar on top and the
 * scene toggles at the bottom. All values in device px.
 */
export function plateRect(width: number, height: number, dpr: number, maxPx: number): PlateRect {
  const top = 64 * dpr;
  const bottom = 64 * dpr;
  // The plate has empty margins around the body, so it may overhang narrow screens a bit.
  const avail = Math.max(120 * dpr, Math.min(width * 1.1, height - top - bottom));
  const size = Math.min(avail, maxPx);
  return {
    x: Math.round((width - size) / 2),
    y: Math.round(top + (height - top - bottom - size) / 2),
    size: Math.round(size),
  };
}

/** Plate-px bounding boxes of a stroke's points from index `from` (and its mirror). */
export function strokeBoxes(op: StrokeOp, from: number, ft: FaceTransform) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = from; i < op.p.length; i += 2) {
    x0 = Math.min(x0, op.p[i]);
    x1 = Math.max(x1, op.p[i]);
    y0 = Math.min(y0, op.p[i + 1]);
    y1 = Math.max(y1, op.p[i + 1]);
  }
  if (!Number.isFinite(x0)) return [];
  const pad = (op.w / 2) * Math.max(ft.kx, ft.ky) + 2;
  const box = (a: number, b: number) => ({
    x: ft.ox + a * ft.kx - pad,
    y: ft.oy + y0 * ft.ky - pad,
    w: (b - a) * ft.kx + pad * 2,
    h: (y1 - y0) * ft.ky + pad * 2,
  });
  return op.m ? [box(x0, x1), box(-x1, -x0)] : [box(x0, x1)];
}
