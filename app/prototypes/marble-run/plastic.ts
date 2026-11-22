// Glossy molded-plastic drawing primitives (2.5D, light from the top-left). World units.

import { BAND_ORDER, PIECE_PLASTIC, PLASTIC, type PlasticName } from "./data";
import { hexToRgb, mix, rgba } from "./theme";
import type { Piece, Rgb } from "./types";

type Ctx = CanvasRenderingContext2D;

export type Shade = { base: Rgb; light: Rgb; spec: Rgb; dark: Rgb; deep: Rgb };

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
/** Direction light comes *from* (top-left), normalised. */
const LIGHT = { x: -0.6, y: -0.8 };

const cache = new Map<PlasticName, Shade>();
export function shade(name: PlasticName): Shade {
  let s = cache.get(name);
  if (!s) {
    const base = hexToRgb(PLASTIC[name]);
    s = {
      base,
      light: mix(base, WHITE, 0.32),
      spec: mix(base, WHITE, 0.78),
      dark: mix(base, BLACK, 0.28),
      deep: mix(base, BLACK, 0.5),
    };
    cache.set(name, s);
  }
  return s;
}

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Each piece is molded in one of its type's colors, picked stably from its id. */
export function pieceShade(p: Piece, offset = 0): Shade {
  const options = PIECE_PLASTIC[p.type];
  return shade(options[(hash(p.id) + offset) % options.length]);
}

export function bandShade(i: number): Shade {
  return shade(BAND_ORDER[((i % BAND_ORDER.length) + BAND_ORDER.length) % BAND_ORDER.length]);
}

/** Cylinder shading across a band, lit edge first. */
function cylinderStops(g: CanvasGradient, s: Shade, alpha = 1) {
  g.addColorStop(0, rgba(s.light, alpha));
  g.addColorStop(0.14, rgba(s.spec, alpha));
  g.addColorStop(0.3, rgba(s.light, alpha));
  g.addColorStop(0.55, rgba(s.base, alpha));
  g.addColorStop(0.86, rgba(s.dark, alpha));
  g.addColorStop(1, rgba(s.deep, alpha));
}

/** A glossy capsule (rod, rail, paddle) from p0 to p1. */
export function bar(ctx: Ctx, s: Shade, x0: number, y0: number, x1: number, y1: number, w: number, alpha = 1, round = true) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.translate((x0 + x1) / 2, (y0 + y1) / 2);
  ctx.rotate(a);
  // Which long edge faces the light?
  const nx = Math.sin(a);
  const ny = -Math.cos(a);
  const topLit = nx * LIGHT.x + ny * LIGHT.y >= 0;
  const g = ctx.createLinearGradient(0, topLit ? -w / 2 : w / 2, 0, topLit ? w / 2 : -w / 2);
  cylinderStops(g, s, alpha);
  ctx.beginPath();
  ctx.roundRect(-len / 2 - (round ? w / 2 : 0), -w / 2, len + (round ? w : 0), w, round ? w / 2 : Math.min(3, w / 3));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** A glossy curved chute band along an arc (inner edge lit, like a trough's lip). */
export function arcBand(ctx: Ctx, s: Shade, cx: number, cy: number, r: number, a0: number, a1: number, w: number, alpha = 1) {
  const g = ctx.createRadialGradient(cx, cy, Math.max(0, r - w / 2), cx, cy, r + w / 2);
  cylinderStops(g, s, alpha);
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.strokeStyle = g;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.stroke();
}

/** Vertical tube segment with soft rounded joints. */
export function tube(ctx: Ctx, s: Shade, x: number, y0: number, y1: number, w: number) {
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  cylinderStops(g, s);
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y0, w, y1 - y0, w * 0.22);
  ctx.fillStyle = g;
  ctx.fill();
}

/** A stacked tube column with alternating color bands and collar joints. */
export function column(ctx: Ctx, x: number, top: number, bottom: number, w: number, seed: number, seg = 58) {
  const n = Math.max(1, Math.round((bottom - top) / seg));
  const h = (bottom - top) / n;
  for (let i = 0; i < n; i++) {
    const y1 = bottom - i * h;
    tube(ctx, bandShade(seed + i), x, y1 - h, y1, w);
  }
  // Collars where segments meet.
  for (let i = 1; i < n; i++) {
    const y = bottom - i * h;
    const s = bandShade(seed + i);
    tube(ctx, s, x, y - 3.5, y + 3.5, w + 5);
    ctx.fillStyle = rgba(s.deep, 0.35);
    ctx.fillRect(x - w / 2 - 2.5, y + 2.5, w + 5, 1.2);
  }
}

/** Filled ellipse with a vertical gloss gradient (rims, caps, dish tops). */
export function ellipseGloss(ctx: Ctx, s: Shade, x: number, y: number, rx: number, ry: number, inverted = false) {
  const g = ctx.createLinearGradient(x - rx * 0.4, y - ry, x + rx * 0.3, y + ry);
  g.addColorStop(0, rgba(inverted ? s.dark : s.spec));
  g.addColorStop(0.45, rgba(inverted ? s.base : s.light));
  g.addColorStop(1, rgba(inverted ? s.light : s.dark));
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

/** Short specular streak (for glossy curved surfaces). */
export function glint(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, alpha = 0.7) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.stroke();
}

/** A rounded base foot that columns stand in. */
export function foot(ctx: Ctx, s: Shade, x: number, floor: number, w: number) {
  const top = floor - 34;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  cylinderStops(g, s);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.32, top);
  ctx.quadraticCurveTo(x - w * 0.36, floor - 10, x - w / 2, floor - 6);
  ctx.quadraticCurveTo(x - w / 2, floor, x - w / 2 + 6, floor);
  ctx.lineTo(x + w / 2 - 6, floor);
  ctx.quadraticCurveTo(x + w / 2, floor, x + w / 2, floor - 6);
  ctx.quadraticCurveTo(x + w * 0.36, floor - 10, x + w * 0.32, top);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ellipseGloss(ctx, s, x, top, w * 0.32, 5);
}
