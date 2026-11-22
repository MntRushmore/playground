// The inside of the pumpkin, seen only through the inner openings: a warm back wall
// with faint inner ribs and stringy pulp, and the candle with its flame.

import { mix, rgba } from "./color";
import { CANDLE, CAVITY_DARK, WAX } from "./data";
import { mulberry32 } from "./noise";
import { type FaceTransform, faceToPlate, setFaceTransform } from "./space";
import type { FrameState, GlowPalette, Rgb } from "./types";

type Ctx = CanvasRenderingContext2D;

/** Flame center (face units). */
export const flameAnchor = () => ({ x: CANDLE.x, y: CANDLE.top - 0.075 });

function backWall(ctx: Ctx, ft: FaceTransform, stops: [number, Rgb][], seed: number, strand: Rgb) {
  const size = ft.size;
  const a = flameAnchor();
  const [cx, cy] = faceToPlate(ft, a.x, a.y);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.72);
  for (const [o, c] of stops) g.addColorStop(o, rgba(c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Inner ribs: soft vertical shadow bands, denser toward the sides.
  setFaceTransform(ctx, ft);
  for (let i = -5; i <= 5; i++) {
    const x = Math.sign(i) * Math.pow(Math.abs(i) / 5, 0.8) * 1.05;
    const band = ctx.createLinearGradient(x - 0.09, 0, x + 0.09, 0);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.5, "rgba(40,10,0,0.22)");
    band.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = band;
    ctx.fillRect(x - 0.09, -1.2, 0.18, 2.4);
  }

  // Stringy pulp clinging to the inside.
  const rand = mulberry32(seed * 31 + 5);
  ctx.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const x = (rand() * 2 - 1) * 1.05;
    const y = -0.8 + rand() * 0.6;
    const len = 0.15 + rand() * 0.45;
    ctx.strokeStyle = rgba(strand, 0.06 + rand() * 0.12);
    ctx.lineWidth = 0.004 + rand() * 0.01;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 0.2, y + len * 0.4, x + (rand() - 0.5) * 0.25, y + len * 0.7, x + (rand() - 0.5) * 0.15, y + len);
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function buildCavity(dark: Ctx, lit: Ctx, ft: FaceTransform, glow: GlowPalette, seed: number) {
  for (const c of [dark, lit]) c.clearRect(0, 0, ft.size, ft.size);
  backWall(dark, ft, [[0, CAVITY_DARK.day], [1, CAVITY_DARK.deep]], seed, [120, 60, 20]);
  backWall(
    lit,
    ft,
    [[0, glow.core], [0.3, glow.mid], [0.7, glow.deep], [1, glow.ember]],
    seed,
    mix(glow.deep, glow.ember, 0.5)
  );
}

/** Wax pillar and flame, drawn into the cavity scratch buffer each frame. */
export function drawCandle(ctx: Ctx, ft: FaceTransform, glow: GlowPalette, s: FrameState) {
  setFaceTransform(ctx, ft);
  const { x, top, width: w, height: h } = CANDLE;
  const lit = s.flame * s.intensity;

  // Pillar with cylindrical shading, its top rim glowing when lit.
  const wax = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  const shade = mix(WAX.shade, CAVITY_DARK.deep, 0.55 - 0.4 * lit);
  const light = mix(mix(WAX.light, glow.mid, 0.3), CAVITY_DARK.day, 0.6 - 0.55 * lit);
  wax.addColorStop(0, rgba(shade));
  wax.addColorStop(0.38, rgba(light));
  wax.addColorStop(1, rgba(shade));
  ctx.fillStyle = wax;
  ctx.beginPath();
  ctx.ellipse(x, top + h, w / 2, w * 0.16, 0, 0, Math.PI);
  ctx.lineTo(x - w / 2, top);
  ctx.ellipse(x, top, w / 2, w * 0.16, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  const rim = ctx.createRadialGradient(x, top, 0, x, top, w * 0.6);
  rim.addColorStop(0, rgba(mix(glow.core, WAX.light, 0.3), 0.25 + 0.75 * lit));
  rim.addColorStop(1, rgba(light, 0.6));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x, top, w / 2, w * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wick.
  ctx.strokeStyle = "rgba(30,18,10,0.9)";
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + s.sway * 0.004, top - 0.022);
  ctx.stroke();

  if (s.flame <= 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return;
  }
  // Flame: a teardrop that leans and stretches with the flicker.
  const fh = 0.135 * s.stretch * (0.35 + 0.65 * s.flame);
  const fw = 0.03 * (0.6 + 0.4 * s.flame);
  const bx = x;
  const by = top - 0.012;
  const tx = bx + s.sway * 0.03;
  const ty = by - fh;
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(bx, by - fh * 0.4, 0, bx, by - fh * 0.4, 0.2);
  halo.addColorStop(0, rgba(glow.mid, 0.55 * lit));
  halo.addColorStop(1, rgba(glow.mid, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(bx - 0.2, by - fh * 0.4 - 0.2, 0.4, 0.4);
  ctx.globalCompositeOperation = "source-over";

  const body = ctx.createRadialGradient(bx, by - fh * 0.22, 0, bx, by - fh * 0.3, fh * 0.75);
  body.addColorStop(0, rgba([255, 255, 250], s.flame));
  body.addColorStop(0.35, rgba(glow.core, s.flame));
  body.addColorStop(0.75, rgba(glow.mid, 0.9 * s.flame));
  body.addColorStop(1, rgba(glow.deep, 0.2 * s.flame));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(bx, by + fw * 0.4);
  ctx.bezierCurveTo(bx - fw * 1.3, by, bx - fw * 0.7, by - fh * 0.55, tx, ty);
  ctx.bezierCurveTo(bx + fw * 0.7, by - fh * 0.55, bx + fw * 1.3, by, bx, by + fw * 0.4);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
