// Procedural set textures as plain canvases: weathered table planks, the board wall and
// a soft contact-shadow decal. Generated once per session and cached.

import { mix, rgba } from "./color";
import { WOOD } from "./data";
import { mulberry32 } from "./noise";
import type { Rgb } from "./types";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const TAU = Math.PI * 2;
/** Wooden boards: grain, knots, worn edges and dark gaps. Planks run along `vertical`. */
function boards(w: number, h: number, count: number, palette: typeof WOOD.table, vertical: boolean, seed: number) {
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(seed);
  const span = vertical ? w : h;
  const len = vertical ? h : w;
  const size = span / count;
  if (!vertical) {
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
  }
  for (let i = 0; i < count; i++) {
    const x0 = i * size;
    const base = mix(palette.dark, palette.light, 0.25 + rand() * 0.55);
    const g = ctx.createLinearGradient(x0, 0, x0 + size, 0);
    g.addColorStop(0, rgba(mix(base, palette.dark, 0.35)));
    g.addColorStop(0.5, rgba(base));
    g.addColorStop(1, rgba(mix(base, palette.dark, 0.45)));
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, size, len);
    // Long blotchy wear along the board.
    for (let k = 0; k < 6; k++) {
      const y = rand() * len;
      const blot = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const tone: Rgb = rand() < 0.5 ? palette.light : palette.dark;
      blot.addColorStop(0, rgba(tone, 0.22));
      blot.addColorStop(1, rgba(tone, 0));
      ctx.save();
      ctx.translate(x0 + size * (0.2 + rand() * 0.6), y);
      ctx.scale(size * 0.5, len * (0.08 + rand() * 0.15));
      ctx.fillStyle = blot;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    // Grain.
    const lines = Math.round(size / 3);
    for (let k = 0; k < lines; k++) {
      const gx = x0 + rand() * size;
      const amp = 2 + rand() * 6;
      const freq = 0.002 + rand() * 0.006;
      const phase = rand() * TAU;
      ctx.strokeStyle = rand() < 0.6 ? rgba(palette.dark, 0.1 + rand() * 0.25) : rgba(palette.light, 0.06 + rand() * 0.12);
      ctx.lineWidth = 0.6 + rand() * 1.6;
      ctx.beginPath();
      for (let y = 0; y <= len; y += 24) {
        const x = gx + Math.sin(y * freq + phase) * amp;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Knots.
    for (let k = 0; k < (rand() < 0.6 ? 1 : 2); k++) {
      const kx = x0 + size * (0.25 + rand() * 0.5);
      const ky = rand() * len;
      for (let r = 4; r >= 1; r--) {
        ctx.strokeStyle = rgba(palette.dark, 0.18 + 0.12 * (4 - r));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * size * 0.03, r * size * 0.09, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // Scratches.
    for (let k = 0; k < 10; k++) {
      const sx = x0 + rand() * size;
      const sy = rand() * len;
      ctx.strokeStyle = rgba(palette.light, 0.08 + rand() * 0.1);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (rand() - 0.5) * size * 0.6, sy + (rand() - 0.5) * 60);
      ctx.stroke();
    }
    // The gap to the next board.
    ctx.fillStyle = rgba(palette.gap);
    ctx.fillRect(x0 + size - 3, 0, 4 + rand() * 2, len);
    ctx.fillStyle = rgba(palette.light, 0.12);
    ctx.fillRect(x0 + 1, 0, 1.5, len);
  }
  return c;
}

let tableCache: HTMLCanvasElement | null = null;
export function tableTexture() {
  if (tableCache) return tableCache;
  const c = boards(2048, 1536, 10, WOOD.table, true, 5);
  const ctx = c.getContext("2d")!;
  // Litter: fallen leaves and seeds.
  const rand = mulberry32(99);
  for (let i = 0; i < 90; i++) {
    const col = WOOD.litter[Math.floor(rand() * WOOD.litter.length)];
    ctx.save();
    ctx.translate(rand() * c.width, rand() * c.height);
    ctx.rotate(rand() * TAU);
    // Pointed leaf / seed silhouettes, small and dull so they read as debris.
    const s = 2 + rand() * 5;
    ctx.fillStyle = rgba(col, 0.3 + rand() * 0.35);
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * 0.45, s, 0);
    ctx.quadraticCurveTo(0, s * 0.45, -s, 0);
    ctx.fill();
    ctx.restore();
  }
  tableCache = c;
  return c;
}

let wallCache: HTMLCanvasElement | null = null;
export function wallTexture() {
  if (!wallCache) wallCache = boards(2048, 1024, 9, WOOD.wall, false, 8);
  return wallCache;
}

let shadowCache: HTMLCanvasElement | null = null;
/** Soft round contact shadow, black with alpha. */
export function shadowDecal() {
  if (shadowCache) return shadowCache;
  const c = canvas(256, 256);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.9)");
  g.addColorStop(0.45, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  shadowCache = c;
  return c;
}
