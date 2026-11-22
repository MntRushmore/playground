// Renders the set for a given canvas/plate layout and composes it (depth of field,
// warm-lit copy). Shared by the live view and the PNG export.

import { canvas2d } from "./export-png";
import { ROUND_DIMS } from "./data";
import { composeSet, warmSet } from "./set-compose";
import type { SetRenderer } from "./set-render";
import { type PlateRect, faceToPlate, faceTransform } from "./space";
import type { PumpkinShape, SetLayers } from "./types";

/** Canvas-px y of the table line under the pumpkin (the focal plane). */
function floorY(shape: PumpkinShape, rect: PlateRect) {
  const ft = faceTransform(shape, rect.size);
  const [, py] = faceToPlate(ft, 0, ROUND_DIMS.b * 0.91);
  return rect.y + (py / ft.size) * rect.size;
}

/** Returns null without WebGL (the frame then uses a plain backdrop). */
export function buildSet(
  setRenderer: SetRenderer | null,
  shape: PumpkinShape,
  w: number,
  h: number,
  r: PlateRect,
  scale: number,
  seed: number
): SetLayers | null {
  if (!setRenderer) return null;
  const sw = Math.max(16, Math.round(w * scale));
  const sh = Math.max(16, Math.round(h * scale));
  const sr = { x: r.x * scale, y: r.y * scale, size: r.size * scale };
  const sharp = { day: canvas2d(1), night: canvas2d(1) };
  setRenderer.render({ width: sw, height: sh, rect: sr, shape }, sharp);
  const focusY = floorY(shape, sr);
  const day = composeSet(sharp.day, { focusY, night: false, seed });
  const ft = faceTransform(shape, sr.size);
  const [hx, hy] = faceToPlate(ft, 0, 0.15);
  const cx = sr.x + (hx / ft.size) * sr.size;
  const cy = sr.y + (hy / ft.size) * sr.size;
  return {
    day,
    night: composeSet(sharp.night, { focusY, night: true, seed }),
    warm: warmSet(day, cx, cy, sr.size * 1.05),
  };
}
