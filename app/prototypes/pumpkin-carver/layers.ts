// Cached compositing layers, rebuilt only when the carving, look or size changes.
// Everything is plate-sized (P×P device px) except the bloom buffers.
//
//   cut / etch masks  ──► inner opening (cut shifted inward + up, ∩ cut)
//        │                     │
//        ├─► walls: cut drawn at increasing depth, tinted rind → flesh → shade
//        ├─► skins: body render with etched flesh painted on, cuts removed
//        ├─► bloom: inner opening + lit walls + etch, downsampled and blurred
//        └─► rays: the same glow zoom-blurred outward (light shafts)

import { mix, rgba } from "./color";
import { CAVITY_DARK, WALL, WALL_DAY } from "./data";
import { paintOps } from "./carving";
import { type FaceTransform, setFaceTransform } from "./space";
import type { GlowPalette, PaintOp, PumpkinPlates, Rgb, SkinPalette } from "./types";

import {
  type Buf,
  type Ctx,
  type Region,
  applyGrain,
  blurInPlace,
  buf,
  clear,
  clip,
  grainTile,
  grow,
  tint,
  unclip,
} from "./layer-ops";
import { buildRays, coarseBox, maskSkinGlow } from "./glow-layers";

export type { Region };

export type Layers = ReturnType<typeof createLayers>;

export function createLayers(size: number) {
  const near = Math.max(8, Math.round(size / 8));
  const far = Math.max(4, Math.round(size / 28));
  return {
    size,
    committedCut: buf(size),
    committedEtch: buf(size),
    cut: buf(size),
    etch: buf(size),
    inner: buf(size),
    innerShade: buf(size),
    wallDay: buf(size),
    wallLit: buf(size),
    skinDay: buf(size),
    skinNight: buf(size),
    skinGlow: buf(size),
    etchGlow: buf(size),
    etchSoft: buf(Math.max(8, Math.round(size / 3))),
    scratch: buf(size),
    tint: buf(size),
    glowSrc: buf(size),
    bloom: buf(near),
    bloomTmp: buf(near),
    bloomFar: buf(far),
    bloomFarTmp: buf(far),
    rays: buf(Math.max(8, Math.round(size / 5))),
    raysTmp: buf(Math.max(8, Math.round(size / 5))),
    grain: grainTile(),
    meter: buf(24, 24, true),
    /** 0–1: how much candle light escapes (carved + etched area). */
    light: 0,
    /** Plate-px box around every opening (null: unknown, use the whole plate). */
    openBox: null as { x: number; y: number; w: number; h: number } | null,
  };
}

/** How far (plate px) a layer can read from its neighbours: the bevel shift plus blur. */
export function regionMargin(ft: FaceTransform) {
  return WALL.shrink * ft.size * 0.75 + WALL.lift * ft.ky + 10;
}

/** Draws `src` as seen at bevel depth f (0 = outer skin, 1 = inner opening). */
function drawAtDepth(dst: Ctx, src: HTMLCanvasElement, ft: FaceTransform, f: number) {
  const s = 1 - WALL.shrink * f;
  const lift = WALL.lift * f * ft.ky;
  dst.setTransform(s, 0, 0, s, ft.ox * (1 - s), ft.oy * (1 - s) - lift);
  dst.drawImage(src, 0, 0);
  dst.setTransform(1, 0, 0, 1, 0, 0);
}

/** Replays committed ops into the committed masks, clipped to the body. */
export function paintCommitted(L: Layers, ops: readonly PaintOp[], ft: FaceTransform, body: HTMLCanvasElement) {
  for (const [b, kind] of [[L.committedCut, "cut"], [L.committedEtch, "etch"]] as const) {
    clear(b);
    setFaceTransform(b.x, ft);
    paintOps(b.x, ops, kind);
    b.x.setTransform(1, 0, 0, 1, 0, 0);
    b.x.globalCompositeOperation = "destination-in";
    b.x.drawImage(body, 0, 0);
    b.x.globalCompositeOperation = "source-over";
  }
}

/** Live masks = committed + strokes not yet committed (the one under the finger). */
export function paintLive(
  L: Layers,
  live: readonly PaintOp[],
  ft: FaceTransform,
  body: HTMLCanvasElement,
  region: Region = null
) {
  const r = grow(region, regionMargin(ft));
  clip([L.cut, L.etch], r);
  for (const [b, base, kind] of [[L.cut, L.committedCut, "cut"], [L.etch, L.committedEtch, "etch"]] as const) {
    clear(b);
    b.x.drawImage(base.c, 0, 0);
    if (!live.length) continue;
    setFaceTransform(b.x, ft);
    paintOps(b.x, live, kind);
    b.x.setTransform(1, 0, 0, 1, 0, 0);
    b.x.globalCompositeOperation = "destination-in";
    b.x.drawImage(body, 0, 0);
    b.x.globalCompositeOperation = "source-over";
  }
  unclip([L.cut, L.etch]);
}

/**
 * The flesh wall of every cut, seen at an angle: the cut mask drawn at increasing depth
 * (each copy shifted toward the body center and up), so the visible band is the wall.
 * Rind line → bright cut edge → flesh, easing toward the inner color deeper in.
 */
function buildWall(L: Layers, dst: Buf, ft: FaceTransform, rind: Rgb, edge: Rgb, outer: Rgb, inner: Rgb) {
  clear(dst);
  tint(L.tint, L.cut.c, rgba(rind));
  drawAtDepth(dst.x, L.tint.c, ft, 0);
  tint(L.tint, L.cut.c, rgba(edge));
  drawAtDepth(dst.x, L.tint.c, ft, 0.05);
  tint(L.tint, L.cut.c, rgba(outer));
  drawAtDepth(dst.x, L.tint.c, ft, 0.13);
  tint(L.tint, L.cut.c, rgba(inner));
  dst.x.globalAlpha = 0.3;
  for (let i = 1; i <= WALL.layers; i++) drawAtDepth(dst.x, L.tint.c, ft, 0.13 + (0.87 * i) / WALL.layers);
  dst.x.globalAlpha = 1;
  dst.x.globalCompositeOperation = "destination-in";
  dst.x.drawImage(L.cut.c, 0, 0);
  dst.x.globalCompositeOperation = "destination-out";
  dst.x.drawImage(L.inner.c, 0, 0);
  dst.x.globalCompositeOperation = "source-over";
}

function buildSkin(L: Layers, dst: Buf, body: HTMLCanvasElement, etchColor: string, lipColor: string, shade: number) {
  clear(dst);
  dst.x.drawImage(body, 0, 0);
  // Scraped flesh: a thin lip along the lower edge (we look down into the shallow
  // scrape), the body's shading multiplied in, and a little grain.
  tint(L.tint, L.etch.c, lipColor);
  tint(L.scratch, L.etch.c, etchColor);
  L.tint.x.drawImage(L.scratch.c, 0, -Math.max(1, L.size * 0.004));
  L.tint.x.globalCompositeOperation = "multiply";
  L.tint.x.globalAlpha = shade;
  L.tint.x.drawImage(body, 0, 0);
  L.tint.x.globalAlpha = 1;
  L.tint.x.globalCompositeOperation = "destination-in";
  L.tint.x.drawImage(L.etch.c, 0, 0);
  L.tint.x.globalCompositeOperation = "source-over";
  applyGrain(L.grain, L.tint, 0.25);
  dst.x.globalCompositeOperation = "source-atop";
  dst.x.globalAlpha = 0.94;
  dst.x.drawImage(L.tint.c, 0, 0);
  dst.x.globalAlpha = 1;
  dst.x.globalCompositeOperation = "destination-out";
  dst.x.drawImage(L.cut.c, 0, 0);
  dst.x.globalCompositeOperation = "source-over";
}

/**
 * Rebuilds every layer derived from the live masks, optionally only inside `region`
 * (while a stroke is being drawn). Scratch buffers are refreshed over a margin around
 * the region because the bevel and soft glow read neighbouring pixels.
 */
export function buildDerived(
  L: Layers,
  plates: PumpkinPlates,
  ft: FaceTransform,
  skin: SkinPalette,
  glow: GlowPalette,
  measureLight: boolean,
  region: Region = null
) {
  const outputs = [L.inner, L.innerShade, L.wallDay, L.wallLit, L.skinDay, L.skinNight, L.skinGlow, L.etchGlow, L.glowSrc];
  const temps = [L.tint, L.scratch];
  const wide = grow(region, regionMargin(ft));
  clip(outputs, region);
  clip(temps, wide);
  clip([L.etchSoft], wide, L.etchSoft.c.width / L.size);
  try {
    buildMasked(L, plates, ft, skin, glow);
  } finally {
    unclip(outputs);
    unclip(temps);
    unclip([L.etchSoft]);
  }
  for (const [b, tmp] of [[L.bloom, L.bloomTmp], [L.bloomFar, L.bloomFarTmp]] as const) {
    clear(b);
    b.x.imageSmoothingQuality = "high";
    b.x.drawImage(L.glowSrc.c, 0, 0, b.c.width, b.c.width);
    blurInPlace(b, tmp, 2);
  }
  buildRays(L, ft);
  maskSkinGlow(L, ft, region, wide);
  if (measureLight) {
    const m = L.meter;
    clear(m);
    m.x.drawImage(L.glowSrc.c, 0, 0, m.c.width, m.c.height);
    const data = m.x.getImageData(0, 0, m.c.width, m.c.height).data;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i];
    // ~5% of the plate glowing reads as "fully lit" (a classic face is ~3–4%).
    L.light = Math.min(1, sum / 255 / (m.c.width * m.c.height) / 0.05);
    L.openBox = coarseBox(data, m.c.width, m.c.height, L.size);
  } else {
    L.openBox = null;
  }
}

function buildMasked(L: Layers, plates: PumpkinPlates, ft: FaceTransform, skin: SkinPalette, glow: GlowPalette) {
  clear(L.inner);
  drawAtDepth(L.inner.x, L.cut.c, ft, 1);
  L.inner.x.globalCompositeOperation = "destination-in";
  L.inner.x.drawImage(L.cut.c, 0, 0);
  L.inner.x.globalCompositeOperation = "source-over";

  // Depth cue: the upper lip of each opening shades the interior right below it.
  clear(L.innerShade);
  for (const [dy, a] of [[0.08, 0.3], [0.05, 0.35], [0.025, 0.35]] as const) {
    clear(L.tint);
    L.tint.x.drawImage(L.inner.c, 0, 0);
    L.tint.x.globalCompositeOperation = "destination-out";
    L.tint.x.drawImage(L.inner.c, 0, dy * ft.ky);
    L.innerShade.x.globalAlpha = a;
    L.innerShade.x.drawImage(L.tint.c, 0, 0);
  }
  L.innerShade.x.globalAlpha = 1;

  buildWall(L, L.wallDay, ft, skin.rind, mix(skin.flesh, [255, 248, 225], 0.45), skin.flesh, mix(skin.fleshShade, WALL_DAY.inner, 0.55));
  buildWall(L, L.wallLit, ft, mix(skin.rind, glow.deep, 0.5), glow.wallInner, glow.wallOuter, glow.wallInner);

  buildSkin(L, L.skinDay, plates.bodyDay, rgba(mix(skin.flesh, [255, 250, 230], 0.25)), rgba(skin.rind), 0.45);
  const nightFlesh = mix(skin.fleshShade, CAVITY_DARK.deep, 0.72);
  buildSkin(L, L.skinNight, plates.bodyNight, rgba(nightFlesh), rgba(mix(nightFlesh, CAVITY_DARK.deep, 0.6)), 0.2);
  const glowFlesh = mix(skin.flesh, glow.mid, 0.5);
  buildSkin(L, L.skinGlow, plates.bodyGlow, rgba(glowFlesh), rgba(mix(glowFlesh, glow.deep, 0.6)), 0.25);

  // Light through thinned skin diffuses: soft edges (down/up-sampled) plus a crisp core.
  tint(L.tint, L.etch.c, rgba(mix(glow.deep, glow.mid, 0.35)));
  clear(L.etchSoft);
  L.etchSoft.x.imageSmoothingQuality = "high";
  L.etchSoft.x.drawImage(L.tint.c, 0, 0, L.etchSoft.c.width, L.etchSoft.c.height);
  clear(L.etchGlow);
  L.etchGlow.x.imageSmoothingQuality = "high";
  L.etchGlow.x.drawImage(L.etchSoft.c, 0, 0, L.size, L.size);
  L.etchGlow.x.globalAlpha = 0.55;
  L.etchGlow.x.drawImage(L.tint.c, 0, 0);
  L.etchGlow.x.globalAlpha = 1;
  applyGrain(L.grain, L.etchGlow, 0.3);
  L.etchGlow.x.globalCompositeOperation = "destination-out";
  L.etchGlow.x.drawImage(L.cut.c, 0, 0);
  L.etchGlow.x.globalCompositeOperation = "source-over";

  // Bloom source: the openings, the candle-lit walls (so thin slits glow too) and a
  // little of the etched glow.
  tint(L.glowSrc, L.inner.c, rgba(glow.mid));
  L.glowSrc.x.globalAlpha = 0.45;
  L.glowSrc.x.drawImage(L.wallLit.c, 0, 0);
  L.glowSrc.x.globalAlpha = 0.25;
  L.glowSrc.x.drawImage(L.etchGlow.c, 0, 0);
  L.glowSrc.x.globalAlpha = 1;
}
