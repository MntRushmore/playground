// Turns a sharp set render into a cinematic plate: depth of field (blurred beyond the
// pumpkin, sharpening toward the front edge of the table), a little haze, and soft
// bokeh. Done once per layout; the result is a static image.

import { rgba } from "./color";
import { mulberry32 } from "./noise";
import type { Rgb } from "./types";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/** Box-ish blur by repeated small offsets at low resolution. */
function blurred(src: HTMLCanvasElement, factor: number, passes: number) {
  const w = Math.max(4, Math.round(src.width / factor));
  const h = Math.max(4, Math.round(src.height / factor));
  const a = canvas(w, h);
  const b = canvas(w, h);
  const ax = a.getContext("2d")!;
  const bx = b.getContext("2d")!;
  ax.imageSmoothingQuality = "high";
  ax.drawImage(src, 0, 0, w, h);
  for (let p = 0; p < passes; p++) {
    const d = 1 + p;
    for (const [from, to, offs] of [
      [a, bx, [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]],
      [b, ax, [[0, 0], [d, d], [-d, d], [d, -d], [-d, -d]]],
    ] as const) {
      to.clearRect(0, 0, w, h);
      to.globalCompositeOperation = "lighter";
      to.globalAlpha = 1 / 5;
      for (const [dx, dy] of offs) to.drawImage(from, dx, dy);
      to.globalAlpha = 1;
      to.globalCompositeOperation = "source-over";
    }
  }
  return a;
}

export type ComposeOptions = {
  /** y (px) of the table line under the pumpkin: the focal plane. */
  focusY: number;
  night: boolean;
  seed: number;
};

/**
 * The day set tinted amber and masked to a pool around the pumpkin: added on top at
 * night so the candle visibly lights the boards and the wall behind.
 */
export function warmSet(day: HTMLCanvasElement, cx: number, cy: number, radius: number) {
  const out = canvas(day.width, day.height);
  const ctx = out.getContext("2d")!;
  ctx.drawImage(day, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgb(255,140,50)";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "destination-in";
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.35, "rgba(0,0,0,0.6)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, out.width, out.height);
  return out;
}

export function composeSet(sharp: HTMLCanvasElement, opts: ComposeOptions) {
  const { width: w, height: h } = sharp;
  const out = canvas(w, h);
  const ctx = out.getContext("2d")!;
  const base: Rgb = opts.night ? [6, 6, 10] : [16, 11, 9];
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, w, h);

  // Far: heavily blurred. Mid: lightly blurred. Near: sharp, faded in toward the front.
  const far = blurred(sharp, 7, 3);
  const mid = blurred(sharp, 3, 1);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(far, 0, 0, w, h);
  const layer = canvas(w, h);
  const lx = layer.getContext("2d")!;
  for (const [img, from, to] of [
    [mid, opts.focusY - h * 0.22, opts.focusY - h * 0.06],
    [sharp, opts.focusY - h * 0.04, opts.focusY + h * 0.06],
  ] as const) {
    lx.globalCompositeOperation = "source-over";
    lx.clearRect(0, 0, w, h);
    lx.imageSmoothingQuality = "high";
    lx.drawImage(img, 0, 0, w, h);
    const g = lx.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    lx.globalCompositeOperation = "destination-in";
    lx.fillStyle = g;
    lx.fillRect(0, 0, w, h);
    ctx.drawImage(layer, 0, 0);
  }
  // The very front edge of the table softens again (shallow focus).
  const front = ctx.createLinearGradient(0, h * 0.9, 0, h);
  front.addColorStop(0, "rgba(0,0,0,0)");
  front.addColorStop(1, rgba(base, 0.45));
  ctx.fillStyle = front;
  ctx.fillRect(0, h * 0.9, w, h * 0.1);

  // Haze hanging over the back of the table.
  const haze = ctx.createLinearGradient(0, opts.focusY - h * 0.45, 0, opts.focusY);
  const hazeCol: Rgb = opts.night ? [60, 70, 110] : [120, 86, 60];
  haze.addColorStop(0, rgba(hazeCol, 0));
  haze.addColorStop(0.7, rgba(hazeCol, opts.night ? 0.07 : 0.08));
  haze.addColorStop(1, rgba(hazeCol, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  // Bokeh: a few soft out-of-focus discs in the background.
  const rand = mulberry32(opts.seed);
  ctx.globalCompositeOperation = "lighter";
  const unit = Math.min(w, h);
  for (let i = 0; i < 9; i++) {
    const x = rand() * w;
    const y = rand() * opts.focusY * 0.85;
    const r = unit * (0.008 + rand() * 0.02);
    const col: Rgb = rand() < 0.7 ? [255, 170, 90] : [150, 170, 255];
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
    const a = (opts.night ? 0.03 : 0.04) * (0.5 + rand());
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.85, rgba(col, a * 1.2));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  return out;
}
