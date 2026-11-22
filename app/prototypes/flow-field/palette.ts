// Stroke color selection. Pure; theme colors come in as data.

import { HUE_BUCKETS } from "./data";
import type { FlowSettings, ThemeColors } from "./types";

/** Index of the hue bucket for a flow angle (spectrum mode). */
export function hueBucket(angle: number) {
  const turns = angle / (Math.PI * 2);
  const frac = turns - Math.floor(turns);
  return Math.floor(frac * HUE_BUCKETS) % HUE_BUCKETS;
}

/** CSS color for each hue bucket. Lighter on dark backgrounds, deeper on light. */
export function spectrumColors(seed: number, theme: ThemeColors) {
  const offset = (seed * 47) % 360;
  const light = theme.dark ? 66 : 46;
  const alpha = theme.dark ? 0.75 : 0.7;
  return Array.from({ length: HUE_BUCKETS }, (_, i) => {
    const hue = (offset + (i / HUE_BUCKETS) * 240) % 360;
    return `hsl(${hue} 80% ${light}% / ${alpha})`;
  });
}

/** Single stroke color for mono / tint modes. */
export function solidColor(s: FlowSettings, theme: ThemeColors) {
  return s.palette === "tint" ? s.tint : theme.foreground;
}

/** Background fill alpha per frame: low = long trails. */
export function fadeAlpha(trails: number) {
  return Math.max(0.03, 1 - trails);
}
