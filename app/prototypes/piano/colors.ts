// Key colors from a theme. Pure: returns CSS oklch() strings.

import { THEME_COLORS } from "./color-themes";
import { isBlack, octaveOf, whiteIndex } from "./music";
import type { Lch, ThemeId } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const css = ([l, c, h]: Lch) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

/** Mix two LCH colors, taking the short way round the hue wheel. */
function mixLch(a: Lch, b: Lch, t: number): Lch {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] + dh * t + 360) % 360];
}

/** Raw LCH for a note: same color in every octave, a touch lighter as you go up. */
export function noteLch(theme: ThemeId, midi: number, dark: boolean): Lch {
  const notes = THEME_COLORS[theme].notes;
  const i = whiteIndex(midi);
  const lift = (octaveOf(midi) - 4) * 0.02;
  if (isBlack(midi)) {
    // Black keys: a deep blend of the two neighbours, so they're colorful too.
    const [l, c, h] = mixLch(notes[i], notes[(i + 1) % 7], 0.5);
    return [clamp(l * (dark ? 0.6 : 0.58) + lift, 0.28, 0.6), c * 0.95, h];
  }
  const [l, c, h] = notes[i];
  // Very light keys glare on a dark page; bring them down a little there.
  return [clamp(l - (dark ? 0.05 : 0) + lift, 0.4, 0.95), c, h];
}

export const keyColor = (theme: ThemeId, midi: number, dark: boolean) =>
  css(noteLch(theme, midi, dark));

/** Soft wash for the stage background behind the last note. */
export function tintColor(theme: ThemeId, midi: number, dark: boolean) {
  const [l, c, h] = noteLch(theme, isBlack(midi) ? midi - 1 : midi, dark);
  return css([dark ? Math.min(l, 0.6) : Math.max(l, 0.8), c * 0.9, h]);
}

/**
 * CSS custom properties for one key, all derived from its content color:
 * face, front lip, glow when pressed, and the name chip.
 */
export function keyVars(color: string, black: boolean): Record<string, string> {
  return {
    "--key": color,
    "--lip": `color-mix(in oklch, ${color} ${black ? 62 : 72}%, black)`,
    "--glow": `color-mix(in oklch, ${color} 75%, transparent)`,
    "--shine": `color-mix(in oklch, white ${black ? 18 : 34}%, transparent)`,
    "--chip": `color-mix(in oklch, ${color} 22%, white)`,
    "--chip-ink": `color-mix(in oklch, ${color} 45%, black)`,
  };
}

/** One color per white note, for the idle wash. */
export function themeSwatches(theme: ThemeId, dark: boolean) {
  return THEME_COLORS[theme].notes.map((_, i) => keyColor(theme, 60 + [0, 2, 4, 5, 7, 9, 11][i], dark));
}
