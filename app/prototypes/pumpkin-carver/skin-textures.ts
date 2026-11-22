// Procedural pumpkin skin detail mapped around the body (u = angle, v = latitude):
// color speckles, a normal map of fine bumps and pores, and a roughness map. Generated
// once per session.

import { createNoise3D, mulberry32 } from "./noise";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const TAU = Math.PI * 2;
let skinCache: { color: HTMLCanvasElement; normal: HTMLCanvasElement; rough: HTMLCanvasElement } | null = null;

/**
 * Skin detail mapped around the pumpkin (u = angle, v = latitude). Noise is sampled on
 * a cylinder so the seam at u = 0/1 is invisible.
 */
export function skinMaps() {
  if (skinCache) return skinCache;
  const w = 1024;
  const h = 512;
  const noise = createNoise3D(1234);
  const height = new Float32Array(w * h);
  const rough = canvas(w, h);
  const rctx = rough.getContext("2d")!;
  const rimg = rctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const a = (x / w) * TAU;
      const cx = Math.cos(a);
      const sx = Math.sin(a);
      // Fine bumps (3 octaves) + long vertical striations that follow the ribs.
      let n = 0;
      let amp = 0.5;
      for (const f of [6, 14, 34]) {
        n += noise(cx * f, sx * f, v * f * 0.8) * amp;
        amp *= 0.55;
      }
      const streak = noise(cx * 60, sx * 60, v * 3) * 0.35;
      height[y * w + x] = n + streak;
      const r = 150 + noise(cx * 4 + 9, sx * 4, v * 5) * 70 + streak * 60;
      const i = (y * w + x) * 4;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(60, Math.min(230, r));
      rimg.data[i + 3] = 255;
    }
  }
  // Pores: tiny pits.
  const rand = mulberry32(77);
  for (let i = 0; i < 3500; i++) {
    const px = Math.floor(rand() * w);
    const py = Math.floor(rand() * h);
    const depth = 0.1 + rand() * 0.18;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = ((py + dy + h) % h) * w + ((px + dx + w) % w);
        height[k] -= depth * (dx === 0 && dy === 0 ? 1 : 0.4);
      }
    }
  }
  rctx.putImageData(rimg, 0, 0);

  const normal = canvas(w, h);
  const nctx = normal.getContext("2d")!;
  const nimg = nctx.createImageData(w, h);
  const strength = 1.2;
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1);
    const dn = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const l = height[y * w + ((x - 1 + w) % w)];
      const r = height[y * w + ((x + 1) % w)];
      const t = height[up * w + x];
      const b = height[dn * w + x];
      let nx = (l - r) * strength;
      let ny = (b - t) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      nimg.data[i] = (nx * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);

  // Color detail (multiplied with vertex colors): pale speckles, faint scars, blotches.
  const color = canvas(w, h);
  const cctx = color.getContext("2d")!;
  cctx.fillStyle = "rgb(238,238,238)";
  cctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const g = cctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const tone = rand() < 0.5 ? "255,255,255" : "200,196,190";
    g.addColorStop(0, `rgba(${tone},0.35)`);
    g.addColorStop(1, `rgba(${tone},0)`);
    cctx.save();
    cctx.translate(rand() * w, rand() * h);
    cctx.scale(20 + rand() * 60, 30 + rand() * 90);
    cctx.fillStyle = g;
    cctx.fillRect(-1, -1, 2, 2);
    cctx.restore();
  }
  for (let i = 0; i < 900; i++) {
    cctx.fillStyle = rand() < 0.8 ? "rgba(255,248,230,0.35)" : "rgba(150,140,120,0.25)";
    cctx.beginPath();
    cctx.ellipse(rand() * w, rand() * h, 0.4 + rand() * 0.9, 0.5 + rand() * 1.3, 0, 0, TAU);
    cctx.fill();
  }
  skinCache = { color, normal, rough };
  return skinCache;
}
