// Per-frame composite onto the visible (or export) canvas. Only cheap drawImage calls and
// a few gradients: everything expensive is cached in Layers.

import { drawCandle } from "./cavity";
import { rgba } from "./color";
import { CAVITY_DARK, ROUND_DIMS } from "./data";
import { outlineStamp } from "./carving";
import type { Layers } from "./layers";
import { type FaceTransform, type PlateRect, setFaceTransform } from "./space";
import type { FrameState, GlowPalette, PumpkinPlates, StampOp, ThemeColors } from "./types";

type Ctx = CanvasRenderingContext2D;

export type FrameInput = {
  layers: Layers;
  plates: PumpkinPlates;
  cavityDark: HTMLCanvasElement;
  cavityLit: HTMLCanvasElement;
  ft: FaceTransform;
  rect: PlateRect;
  theme: ThemeColors;
  glow: GlowPalette;
  glowAmount: number;
  state: FrameState;
  /** 0–1 fade-in of the pumpkin once its render is ready. */
  appear: number;
  preview?: StampOp | null;
  /** Device px per CSS px, for hairline UI strokes. */
  dpr: number;
};

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

export function drawFrame(ctx: Ctx, f: FrameInput) {
  const { layers: L, plates, ft, rect, theme, glow, state: s } = f;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const { x, y, size } = rect;
  const lit = s.flame * s.intensity;
  const light = Math.max(L.light, 0.05) * lit * f.glowAmount;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, w, h);
  if (s.dark > 0) {
    ctx.globalAlpha = s.dark;
    ctx.fillStyle = theme.night;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  const floorY = ROUND_DIMS.b * 0.97;
  // Halo and floor pool of escaping light (mostly visible in the dark).
  const night = 0.12 + 0.88 * s.dark;
  if (light > 0.001) {
    ellipseGlow(ctx, ft, rect, 0, 0.05, 1.9, 1.7, [
      [0, rgba(glow.deep, 0.32 * light * night)],
      [1, rgba(glow.mid, 0)],
    ]);
    ellipseGlow(ctx, ft, rect, 0, floorY + 0.06, 1.75, 0.34, [
      [0, rgba(glow.mid, 0.7 * light * night)],
      [0.5, rgba(glow.deep, 0.3 * light * night)],
      [1, rgba(glow.deep, 0)],
    ]);
  }
  // Contact shadow.
  ellipseGlow(ctx, ft, rect, 0, floorY, 1.05, 0.12, [
    [0, `rgba(0,0,0,0.42)`],
    [1, "rgba(0,0,0,0)"],
  ]);

  // Skin, day and night versions cross-faded.
  ctx.drawImage(L.skinDay.c, x, y, size, size);
  if (s.dark > 0) {
    ctx.globalAlpha = s.dark;
    ctx.drawImage(L.skinNight.c, x, y, size, size);
  }
  // Etched (thinned) skin glows from behind: a hint by day, additive amber in the dark.
  ctx.globalAlpha = lit * 0.18 * (1 - s.dark);
  ctx.drawImage(L.etchGlow.c, x, y, size, size);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, lit * f.glowAmount * 0.6 * s.dark);
  ctx.drawImage(L.etchGlow.c, x, y, size, size);
  ctx.globalCompositeOperation = "source-over";

  // Walls of the cuts: daylight flesh (fading into the dark), then candle-lit flesh.
  ctx.globalAlpha = 1 - 0.85 * s.dark;
  ctx.drawImage(L.wallDay.c, x, y, size, size);
  ctx.globalAlpha = Math.min(1, lit * (0.4 + 0.6 * s.dark));
  ctx.drawImage(L.wallLit.c, x, y, size, size);

  // The interior through the inner openings, with the live flame.
  const sc = L.scratch.x;
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = "copy";
  sc.drawImage(f.cavityDark, 0, 0);
  sc.globalCompositeOperation = "source-over";
  sc.globalAlpha = Math.min(1, lit * (0.75 + 0.25 * s.dark));
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
  sc.globalCompositeOperation = "destination-in";
  sc.drawImage(L.inner.c, 0, 0);
  sc.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(L.scratch.c, x, y, size, size);

  ctx.drawImage(plates.stemDay, x, y, size, size);
  if (s.dark > 0) {
    ctx.globalAlpha = s.dark;
    ctx.drawImage(plates.stemNight, x, y, size, size);
  }

  // Bloom: light spilling out of the openings.
  const bloom = Math.min(1.4, lit * f.glowAmount * (0.3 + 0.9 * s.dark));
  if (bloom > 0.01) {
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingQuality = "high";
    ctx.globalAlpha = Math.min(1, bloom);
    ctx.drawImage(L.bloom.c, x, y, size, size);
    ctx.drawImage(L.bloomFar.c, x, y, size, size);
    const pad = size * 0.05;
    ctx.globalAlpha = Math.min(1, bloom * 0.7);
    ctx.drawImage(L.bloomFar.c, x - pad, y - pad, size + pad * 2, size + pad * 2);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;

  if (s.dark > 0) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${0.55 * s.dark})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  // Fade in from the backdrop as a whole (per-layer alpha would let layers show through).
  if (f.appear < 1) {
    ctx.globalAlpha = 1 - f.appear;
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, w, h);
    if (s.dark > 0) {
      ctx.globalAlpha = (1 - f.appear) * s.dark;
      ctx.fillStyle = theme.night;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  }

  if (f.preview) {
    setFaceTransform(ctx, ft, rect);
    const px = ft.kx * (size / ft.size);
    ctx.lineWidth = (1.5 * f.dpr) / px;
    ctx.setLineDash([(5 * f.dpr) / px, (4 * f.dpr) / px]);
    ctx.strokeStyle = s.dark > 0.5 ? "rgba(255,255,255,0.85)" : theme.foreground;
    outlineStamp(ctx, f.preview);
    ctx.setLineDash([]);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
