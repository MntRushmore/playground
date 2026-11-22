// Color helpers and palette derivation. Pure.

import { GLOW_COOL, GLOW_WARM } from "./data";
import type { GlowPalette, Rgb, SkinPalette, Variety } from "./types";

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const rgba = (c: Rgb, alpha = 1) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

/** h, s, l in 0–1 → RGB 0–255. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (((n + h * 12) % 12) + 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function glowPalette(warmth: number): GlowPalette {
  const t = Math.min(1, Math.max(0, warmth));
  const out = {} as GlowPalette;
  for (const key of Object.keys(GLOW_COOL) as (keyof GlowPalette)[]) {
    out[key] = mix(GLOW_COOL[key], GLOW_WARM[key], t);
  }
  return out;
}

/** Skin colors as HSL (0–1) so the renderer can vary them per vertex. */
export function skinPalette(variety: Variety, hueDeg: number): SkinPalette {
  const h = hueDeg / 360;
  switch (variety) {
    case "ghost":
      return {
        base: [0.11, 0.3, 0.86],
        top: [0.2, 0.18, 0.74],
        crease: [0.09, 0.26, 0.66],
        flesh: [255, 196, 112],
        fleshShade: [214, 132, 52],
        rind: [196, 150, 96],
      };
    case "fairytale":
      return {
        base: [0.065, 0.5, 0.5],
        top: [0.16, 0.3, 0.42],
        crease: [0.04, 0.46, 0.34],
        flesh: [255, 170, 86],
        fleshShade: [204, 108, 40],
        rind: [150, 70, 34],
      };
    default:
      return {
        base: [h, 0.9, 0.5],
        top: [h + 0.035, 0.8, 0.5],
        crease: [h - 0.015, 0.88, 0.34],
        flesh: hslToRgb(h + 0.05, 0.92, 0.74),
        fleshShade: hslToRgb(h + 0.02, 0.8, 0.52),
        rind: hslToRgb(h - 0.01, 0.85, 0.36),
      };
  }
}
