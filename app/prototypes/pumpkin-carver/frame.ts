// Per-frame composite onto the visible (or export) canvas. Only drawImage calls, a few
// gradients, motes and grain: everything expensive is cached in Layers / the set.

import { drawGrain, drawMotes } from "./atmosphere";
import { drawCandle } from "./cavity";
import { rgba } from "./color";
import { CAVITY_DARK, ROUND_DIMS } from "./data";
import type { Layers } from "./layers";
import { type FaceTransform, type PlateRect, faceToPlate, setFaceTransform } from "./space";
import type { FrameState, GlowPalette, PumpkinPlates, SetLayers, ThemeColors } from "./types";

type Ctx = CanvasRenderingContext2D;

export type FrameInput = {
  layers: Layers;
  plates: PumpkinPlates;
  /** The set, plus the plate rect it was rendered for and where the plate is now. */
  set: (SetLayers & { rect: PlateRect; view: PlateRect }) | null;
  cavityDark: HTMLCanvasElement;
  cavityLit: HTMLCanvasElement;
  ft: FaceTransform;
  rect: PlateRect;
  theme: ThemeColors;
  glow: GlowPalette;
  glowAmount: number;
  state: FrameState;
  /** 0–1 fade-in of the scene once its render is ready. */
  appear: number;
};

/** Face-space y of the table under the pumpkin. */
const FLOOR_Y = ROUND_DIMS.b * 0.91;

function ellipseGlow(ctx: Ctx, ft: FaceTransform, rect: PlateRect, cx: number, cy: number, rx: number, ry: number, stops: [number, string][]) {
  setFaceTransform(ctx, ft, rect);
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * When the plate shrinks above the mobile sheet, slide the set up so the table line
 * stays under the pumpkin (scaling it would leave bare edges; the sheet covers the
 * bottom anyway).
 */
function setShift(f: FrameInput) {
  if (!f.set) return 0;
  const frac = (f.ft.oy + FLOOR_Y * f.ft.ky) / f.ft.size;
  const { rect, view } = f.set;
  return view.y + frac * view.size - (rect.y + frac * rect.size);
}

function backdrop(ctx: Ctx, f: FrameInput) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const s = f.state;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = f.theme.night;
  ctx.fillRect(0, 0, w, h);
  if (!f.set) return;
  ctx.setTransform(1, 0, 0, 1, 0, setShift(f));
  ctx.imageSmoothingQuality = "high";
  // Skip layers that are fully covered (big full-canvas blits matter on phones).
  if (s.dark < 0.999) ctx.drawImage(f.set.day, 0, 0, w, h);
  if (s.dark > 0) {
    ctx.globalAlpha = s.dark;
    ctx.drawImage(f.set.night, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function drawFrame(ctx: Ctx, f: FrameInput) {
  const { layers: L, plates, ft, rect, glow, state: s } = f;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const { x, y, size } = rect;
  const lit = s.flame * s.intensity;
  const light = Math.max(L.light, 0.06) * lit * f.glowAmount;
  const night = 0.3 + 0.7 * s.dark;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, f);

  // Light spilling onto the wall and table: the set re-lit warm around the pumpkin,
  // plus a hot pool on the table and a tight contact shadow.
  if (light > 0.001 && f.set) {
    ctx.setTransform(1, 0, 0, 1, 0, setShift(f));
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, 1.1 * light * night);
    ctx.drawImage(f.set.warm, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (light > 0.001) {
    ctx.globalCompositeOperation = "lighter";
    ellipseGlow(ctx, ft, rect, 0, -0.05, 2.6, 2.2, [
      [0, rgba(glow.deep, 0.42 * light * night)],
      [0.5, rgba(glow.ember, 0.22 * light * night)],
      [1, rgba(glow.ember, 0)],
    ]);
    ellipseGlow(ctx, ft, rect, 0, FLOOR_Y + 0.12, 2.4, 0.55, [
      [0, rgba(glow.mid, 0.6 * light * night)],
      [0.45, rgba(glow.deep, 0.3 * light * night)],
      [1, rgba(glow.deep, 0)],
    ]);
    ctx.globalCompositeOperation = "source-over";
  }
  ellipseGlow(ctx, ft, rect, 0, FLOOR_Y - 0.01, 0.95, 0.09, [
    [0, "rgba(0,0,0,0.6)"],
    [1, "rgba(0,0,0,0)"],
  ]);

  // Skin: room light, moonlight, and the candle's warm glow from within.
  if (s.dark < 0.999) ctx.drawImage(L.skinDay.c, x, y, size, size);
  if (s.dark > 0) {
    ctx.globalAlpha = s.dark;
    ctx.drawImage(L.skinNight.c, x, y, size, size);
  }
  const skinGlow = Math.min(1, lit * f.glowAmount * (0.3 + 0.7 * s.dark));
  if (skinGlow > 0.01) {
    ctx.globalAlpha = skinGlow;
    ctx.drawImage(L.skinGlow.c, x, y, size, size);
  }

  // Etched (thinned) skin glows from behind: a hint by day, additive amber in the dark.
  ctx.globalAlpha = lit * 0.18 * (1 - s.dark);
  ctx.drawImage(L.etchGlow.c, x, y, size, size);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, lit * f.glowAmount * 0.65 * s.dark);
  ctx.drawImage(L.etchGlow.c, x, y, size, size);
  ctx.globalCompositeOperation = "source-over";

  // Walls of the cuts: daylight flesh (fading into the dark), then candle-lit flesh.
  ctx.globalAlpha = 1 - 0.85 * s.dark;
  ctx.drawImage(L.wallDay.c, x, y, size, size);
  ctx.globalAlpha = Math.min(1, lit * (0.45 + 0.55 * s.dark));
  ctx.drawImage(L.wallLit.c, x, y, size, size);

  // The interior through the inner openings, with the live flame.
  const sc = L.scratch.x;
  const box = L.openBox ?? { x: 0, y: 0, w: ft.size, h: ft.size };
  sc.setTransform(1, 0, 0, 1, 0, 0);
  // The scratch doubles as a temp buffer elsewhere: clear a rim so scaling never
  // samples leftovers.
  sc.clearRect(box.x - 3, box.y - 3, box.w + 6, box.h + 6);
  sc.save();
  sc.beginPath();
  sc.rect(box.x, box.y, box.w, box.h);
  sc.clip();
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = "copy";
  sc.drawImage(f.cavityDark, 0, 0);
  sc.globalCompositeOperation = "source-over";
  sc.globalAlpha = Math.min(1, lit * (0.8 + 0.2 * s.dark));
  sc.drawImage(f.cavityLit, 0, 0);
  sc.globalAlpha = 1;
  drawCandle(sc, ft, glow, s);
  sc.setTransform(1, 0, 0, 1, 0, 0);
  // With the candle out and the lights off, the inside is close to black.
  const unlit = 0.85 * s.dark * (1 - s.flame);
  if (unlit > 0.01) {
    sc.globalAlpha = unlit;
    sc.fillStyle = rgba(CAVITY_DARK.deep);
    sc.fillRect(0, 0, ft.size, ft.size);
    sc.globalAlpha = 1;
  }
  // Shadow under the top lip of each opening sells the depth of the cut.
  sc.globalAlpha = 0.75;
  sc.globalCompositeOperation = "source-atop";
  sc.drawImage(L.innerShade.c, 0, 0);
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = "destination-in";
  sc.drawImage(L.inner.c, 0, 0);
  sc.restore();
  ctx.globalAlpha = 1;
  const k = size / ft.size;
  if (box.w > 0 && box.h > 0) ctx.drawImage(L.scratch.c, box.x, box.y, box.w, box.h, x + box.x * k, y + box.y * k, box.w * k, box.h * k);

  if (s.dark < 0.999) ctx.drawImage(plates.stemDay, x, y, size, size);
  if (s.dark > 0) {
    ctx.globalAlpha = s.dark;
    ctx.drawImage(plates.stemNight, x, y, size, size);
  }
  ctx.globalAlpha = 1;

  // Bloom and light shafts bleeding out of the openings.
  const bloom = Math.min(1.5, lit * f.glowAmount * (0.35 + 0.95 * s.dark));
  if (bloom > 0.01) {
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = Math.min(1, bloom);
    ctx.drawImage(L.bloom.c, x, y, size, size);
    ctx.globalAlpha = Math.min(1, bloom);
    // One wide pass of the far bloom, slightly oversized so it spills past the body.
    const pad = size * 0.04;
    ctx.drawImage(L.bloomFar.c, x - pad, y - pad, size + pad * 2, size + pad * 2);
    ctx.globalAlpha = Math.min(1, bloom * 0.35);
    ctx.drawImage(L.rays.c, x, y, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;

  const [hx, hy] = faceToPlate(ft, 0, 0);
  const center: [number, number] = [x + (hx / ft.size) * size, y + (hy / ft.size) * size];
  drawMotes(ctx, s.time, size, lit * Math.min(1, L.light * 1.5 + 0.2) * (0.3 + 0.7 * s.dark), center);

  // Vignette and film grain.
  const v = ctx.createRadialGradient(center[0], center[1], Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${0.5 + 0.25 * s.dark})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  drawGrain(ctx, s.time, s.moving, 0.09 + 0.05 * s.dark);

  // Fade in from the backdrop as a whole (per-layer alpha would let layers show through).
  if (f.appear < 1) {
    ctx.globalAlpha = 1 - f.appear;
    ctx.fillStyle = f.theme.night;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
