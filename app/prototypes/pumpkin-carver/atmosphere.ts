// Air in the scene: drifting dust/ember motes and film grain. Motes are a pure function
// of time (no state to step), so reduced motion just freezes time.

import { MOTES } from "./data";
import { mulberry32 } from "./noise";

type Mote = { x: number; y: number; speed: number; drift: number; phase: number; size: number; depth: number };

let motes: Mote[] | null = null;
function field(): Mote[] {
  if (motes) return motes;
  const rand = mulberry32(2024);
  motes = Array.from({ length: MOTES.count }, () => ({
    x: rand(),
    y: rand(),
    speed: 0.006 + rand() * 0.018,
    drift: 0.004 + rand() * 0.012,
    phase: rand() * Math.PI * 2,
    size: 0.6 + rand() * 1.6,
    depth: rand(),
  }));
  return motes;
}

const sprites = new Map<string, HTMLCanvasElement>();
function dot(color: readonly number[]) {
  const key = color.join(",");
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, `rgba(${key},1)`);
  g.addColorStop(0.25, `rgba(${key},0.6)`);
  g.addColorStop(1, `rgba(${key},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  sprites.set(key, c);
  return c;
}

/**
 * Motes rise slowly and sway. Near the pumpkin's glow they read as embers (warm,
 * brighter); otherwise as cool dust catching the moonlight.
 */
export function drawMotes(
  ctx: CanvasRenderingContext2D,
  t: number,
  unit: number,
  glow: number,
  center: [number, number]
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const ember = dot(MOTES.ember);
  const dust = dot(MOTES.dust);
  ctx.globalCompositeOperation = "lighter";
  for (const m of field()) {
    const y = (((m.y - t * m.speed) % 1) + 1) % 1;
    const x = m.x + Math.sin(t * 0.4 + m.phase) * m.drift;
    const px = x * w;
    const py = y * h;
    const near = Math.max(0, 1 - Math.hypot(px - center[0], py - center[1]) / (unit * 0.9));
    const warmth = Math.min(1, glow * (0.35 + near));
    const twinkle = 0.6 + 0.4 * Math.sin(t * (1.3 + m.depth) + m.phase * 3);
    const a = (0.1 + 0.55 * warmth * near + 0.2 * warmth) * twinkle * (0.45 + m.depth * 0.55);
    if (a < 0.01) continue;
    const s = unit * 0.007 * m.size * (0.6 + m.depth);
    ctx.globalAlpha = Math.min(1, a * warmth);
    ctx.drawImage(ember, px - s, py - s, s * 2, s * 2);
    ctx.globalAlpha = Math.min(1, a * (1 - warmth) * 0.7);
    ctx.drawImage(dust, px - s, py - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

let grainTile: HTMLCanvasElement | null = null;
/** 192px tile of monochrome noise (centered on mid-grey for overlay blending). */
export function grain() {
  if (grainTile) return grainTile;
  grainTile = document.createElement("canvas");
  grainTile.width = grainTile.height = 192;
  const ctx = grainTile.getContext("2d")!;
  const img = ctx.createImageData(192, 192);
  const rand = mulberry32(31337);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rand() + rand() + rand() - 1.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return grainTile;
}

/** Film grain over the whole frame; the offset jumps every frame unless frozen. */
export function drawGrain(ctx: CanvasRenderingContext2D, t: number, moving: boolean, strength: number) {
  const pattern = ctx.createPattern(grain(), "repeat");
  if (!pattern) return;
  const step = moving ? Math.floor(t * 24) : 0;
  const ox = (step * 73) % 192;
  const oy = (step * 151) % 192;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = strength;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(ox, oy, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
