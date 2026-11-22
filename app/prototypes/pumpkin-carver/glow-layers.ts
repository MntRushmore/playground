// Glow-related layers derived after the bloom: light shafts, the candle-lit skin mask,
// and the openings' bounding box (used to clip the per-frame interior pass).

import { type FaceTransform } from "./space";
import { type Region, blurInPlace, clear, clip, unclip } from "./layer-ops";
import type { Layers } from "./layers";

/** Light shafts: the glow source zoom-blurred outward from the face center. */
export function buildRays(L: Layers, ft: FaceTransform) {
  const r = L.rays;
  const w = r.c.width;
  const k = w / L.size;
  const cx = ft.ox * k;
  const cy = ft.oy * k;
  clear(r);
  r.x.imageSmoothingQuality = "high";
  r.x.drawImage(L.glowSrc.c, 0, 0, w, w);
  // Each pass doubles the reach: 4 passes ≈ 16 copies.
  for (let pass = 0; pass < 4; pass++) {
    const scale = 1 + 0.045 * 2 ** pass;
    clear(L.raysTmp);
    L.raysTmp.x.globalAlpha = 0.5;
    L.raysTmp.x.drawImage(r.c, 0, 0);
    L.raysTmp.x.globalAlpha = 1;
    clear(r);
    r.x.drawImage(L.raysTmp.c, 0, 0);
    r.x.globalCompositeOperation = "lighter";
    r.x.globalAlpha = 1;
    r.x.setTransform(scale, 0, 0, scale, cx * (1 - scale), cy * (1 - scale));
    r.x.drawImage(L.raysTmp.c, 0, 0);
    r.x.setTransform(1, 0, 0, 1, 0, 0);
    r.x.globalAlpha = 1;
    r.x.globalCompositeOperation = "source-over";
  }
  blurInPlace(r, L.raysTmp, 1);
}

/**
 * The candle-lit skin is brightest around the openings (light scatters through the thin
 * flesh there) and falls off toward the silhouette: mask it with the far bloom plus a
 * soft central pool.
 */
export function maskSkinGlow(L: Layers, ft: FaceTransform, region: Region, wide: Region) {
  clip([L.skinGlow], region);
  clip([L.tint], wide);
  clear(L.tint);
  const g = L.tint.x.createRadialGradient(ft.ox, ft.oy, 0, ft.ox, ft.oy, ft.kx * 1.15);
  g.addColorStop(0, "rgba(0,0,0,0.5)");
  g.addColorStop(0.7, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0.06)");
  L.tint.x.fillStyle = g;
  L.tint.x.fillRect(0, 0, L.size, L.size);
  L.tint.x.globalCompositeOperation = "lighter";
  L.tint.x.imageSmoothingQuality = "high";
  L.tint.x.drawImage(L.bloomFar.c, 0, 0, L.size, L.size);
  L.tint.x.drawImage(L.bloomFar.c, 0, 0, L.size, L.size);
  L.tint.x.globalCompositeOperation = "source-over";
  L.skinGlow.x.globalCompositeOperation = "destination-in";
  L.skinGlow.x.drawImage(L.tint.c, 0, 0);
  L.skinGlow.x.globalCompositeOperation = "source-over";
  unclip([L.skinGlow]);
  unclip([L.tint]);
}

/** Bounding box (plate px, one cell of margin) of non-empty cells in a tiny alpha grid. */
export function coarseBox(data: Uint8ClampedArray, gw: number, gh: number, size: number) {
  let x0 = gw, y0 = gh, x1 = -1, y1 = -1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (data[(y * gw + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 0, h: 0 };
  const cw = size / gw;
  const ch = size / gh;
  // Whole pixels, so drawing the box never samples stale pixels just outside it.
  const x = Math.max(0, Math.floor((x0 - 1) * cw));
  const y = Math.max(0, Math.floor((y0 - 1) * ch));
  return { x, y, w: Math.min(size, Math.ceil((x1 + 2) * cw)) - x, h: Math.min(size, Math.ceil((y1 + 2) * ch)) - y };
}
