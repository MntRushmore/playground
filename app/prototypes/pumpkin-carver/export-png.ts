// Renders a still of the current carving at export resolution, using the same layer
// pipeline as the live view, into a PNG blob.

import { buildCavity } from "./cavity";
import { glowPalette, skinPalette } from "./color";
import { STEADY } from "./flicker";
import { drawFrame } from "./frame";
import { buildDerived, createLayers, paintCommitted, paintLive } from "./layers";
import { type PlateRect, faceTransform } from "./space";
import type { PaintOp, PumpkinPlates, SetLayers, Settings, ThemeColors } from "./types";

export const canvas2d = (size: number) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
};

/** `rect` is where the pumpkin plate sits inside the square export frame. */
export function renderPng(
  plates: PumpkinPlates,
  set: SetLayers | null,
  rect: PlateRect,
  settings: Settings,
  ops: readonly PaintOp[],
  theme: ThemeColors,
  scene: { dark: number; flame: number }
): Promise<Blob | null> {
  const size = plates.size;
  const ft = faceTransform(settings.shape, size);
  const glow = glowPalette(settings.warmth);
  const layers = createLayers(size);
  const cavityDark = canvas2d(size);
  const cavityLit = canvas2d(size);
  paintCommitted(layers, ops, ft, plates.bodyDay);
  paintLive(layers, [], ft, plates.bodyDay);
  buildDerived(layers, plates, ft, skinPalette(settings.variety, settings.hue), glow, true);
  buildCavity(cavityDark.getContext("2d")!, cavityLit.getContext("2d")!, ft, glow, settings.seed);

  const out = canvas2d(size);
  drawFrame(out.getContext("2d")!, {
    layers,
    plates,
    set: set && { ...set, rect, view: rect },
    cavityDark,
    cavityLit,
    ft,
    glow,
    rect,
    theme,
    glowAmount: settings.glow,
    // A steady, fully bright flame reads best in a still; motes frozen, grain fixed.
    state: { ...scene, ...STEADY, intensity: 1, time: 2.5, moving: false },
    appear: 1,
  });
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
