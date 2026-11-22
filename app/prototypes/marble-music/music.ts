// Pitch quantization and pitch colors. Pure, no DOM.

import { DEGREE_HUES, INSTRUMENTS, KEYS, NOTE_TONE, SCALES } from "./data";
import type { Settings } from "./types";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** MIDI note for a bar degree in the current key/scale/instrument register. */
export function degreeToMidi(degree: number, s: Pick<Settings, "scale" | "key" | "instrument">) {
  const steps = SCALES[s.scale].steps;
  const keyIndex = Math.max(0, KEYS.indexOf(s.key));
  const octave = INSTRUMENTS[s.instrument].octave;
  const n = steps.length;
  const d = Math.max(0, Math.round(degree));
  return 12 * (octave + 1) + keyIndex + 12 * Math.floor(d / n) + steps[d % n];
}

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/**
 * Maps impact speed to a 0..1 velocity with a soft knee, so gentle taps are quiet
 * and hard falls are bright without clipping.
 */
export function impactVelocity(speed: number, minSpeed: number, refSpeed: number) {
  if (speed <= minSpeed) return 0;
  const t = Math.min(1, (speed - minSpeed) / Math.max(1, refSpeed - minSpeed));
  return 0.12 + 0.88 * Math.pow(t, 0.7);
}

/** oklch color for a degree; `lift` brightens (glow), alpha optional. */
export function noteColor(degree: number, dark: boolean, lift = 0, alpha = 1, chroma = 1) {
  const tone = dark ? NOTE_TONE.dark : NOTE_TONE.light;
  const hue = DEGREE_HUES[Math.max(0, Math.min(DEGREE_HUES.length - 1, Math.round(degree)))];
  // Yellows go olive when darkened for light backgrounds: keep them a touch lighter.
  const warm = !dark && hue >= 55 && hue <= 115 ? 0.05 : 0;
  const l = Math.min(0.97, tone.l + warm + lift * (dark ? 0.14 : 0.06));
  const c = tone.c * chroma * (1 - lift * 0.25);
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${hue} / ${alpha.toFixed(3)})`;
}
