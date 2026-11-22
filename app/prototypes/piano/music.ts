// Note math. Pure, no DOM or React.

import { KEY_CODES, LETTER_NAMES, LOUDNESS_KNEE, SOLFEGE_NAMES } from "./data";
import type { LabelMode } from "./types";

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
/** Pitch class → index among the seven white notes (C=0 … B=6). */
const WHITE_INDEX: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

export const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;
export const isBlack = (midi: number) => BLACK_PCS.has(pitchClass(midi));
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

/** MIDI number of C in the given scientific octave (C4 = 60). */
export const cOf = (octave: number) => (octave + 1) * 12;

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** 0–6 for white notes; for black notes, the white note just below. */
export function whiteIndex(midi: number) {
  const pc = pitchClass(midi);
  return WHITE_INDEX[pc] ?? WHITE_INDEX[pc - 1];
}

/** Friendly name for a white key, or null when labels are off / the key is black. */
export function noteLabel(midi: number, mode: LabelMode): string | null {
  if (mode === "none" || isBlack(midi)) return null;
  const names = mode === "solfege" ? SOLFEGE_NAMES : LETTER_NAMES;
  return names[whiteIndex(midi)];
}

/** MIDI note for a computer-keyboard code, if it lands on a key that's on screen. */
export function midiForKeyCode(code: string, lowest: number, highest: number, blackKeys: boolean) {
  const offset = KEY_CODES[code];
  if (offset === undefined) return null;
  const midi = lowest + offset;
  if (midi > highest || (!blackKeys && isBlack(midi))) return null;
  return midi;
}

/** Equal-loudness-ish trim: high notes are turned down a little so they never get piercing. */
export function loudnessTrim(freq: number) {
  return freq <= LOUDNESS_KNEE ? 1 : (LOUDNESS_KNEE / freq) ** 0.45;
}

/** Low notes a little left, high notes a little right (headphones feel wider). */
export function panFor(midi: number, lowest: number, highest: number) {
  if (highest <= lowest) return 0;
  return ((midi - lowest) / (highest - lowest) - 0.5) * 0.5;
}
