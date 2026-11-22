// Canvas colors. Tokens are read from CSS at runtime (they may be oklch), resolved to RGB
// through a 1×1 canvas so they can be mixed freely.

import type { Rgb, ThemeColors } from "./types";

let probe: CanvasRenderingContext2D | null = null;

function toRgb(color: string, fallback: Rgb): Rgb {
  if (!color) return fallback;
  if (!probe) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

export function readTheme(el: HTMLElement, resolvedTheme: string | undefined): ThemeColors {
  const css = getComputedStyle(el);
  const dark = resolvedTheme !== "light";
  const get = (name: string, fb: Rgb) => toRgb(css.getPropertyValue(name).trim(), fb);
  return {
    dark,
    background: get("--background", dark ? [23, 23, 23] : [255, 255, 255]),
    foreground: get("--foreground", dark ? [250, 250, 250] : [23, 23, 23]),
  };
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgba(c: Rgb, alpha = 1) {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** What the canvas needs from the theme: backdrop and ink for the editing overlay. */
export function boardPalette(t: ThemeColors) {
  return { bg: t.background, fg: t.foreground, dark: t.dark };
}

export type BoardPalette = ReturnType<typeof boardPalette>;
