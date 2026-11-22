// Sound presets: plain data for the additive synth in synth.ts.
// Each was checked by rendering it offline and listening with earshot (see HOW_IT_WORKS.md).

import type { Preset, PresetId } from "./types";

export const PRESETS: Record<PresetId, Preset> = {
  piano: {
    transpose: 0,
    // Two slightly detuned "strings", gently stretched overtones that fade high-first,
    // a soft felt-hammer thump and a brightness that mellows right after the strike.
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 1, gain: 0.6, detune: 2 },
      { ratio: 2.002, gain: 0.7, decay: 1.4 },
      { ratio: 3.005, gain: 0.45, decay: 0.8 },
      { ratio: 4.013, gain: 0.3, decay: 0.45 },
      { ratio: 5.025, gain: 0.2, decay: 0.3 },
      { ratio: 6.04, gain: 0.12, decay: 0.2 },
      { ratio: 7.06, gain: 0.07, decay: 0.14 },
      { ratio: 8.08, gain: 0.05, decay: 0.1 },
    ],
    env: { attack: 0.003, decay: 3.5, sustain: 0, release: 0.4 },
    filter: { mul: 4, max: 4500, peakMul: 16, decay: 0.25, q: 0.3 },
    strike: { gain: 0.6, decay: 0.04, mul: 1.5, q: 0.7 },
    gain: 0.13,
  },
  musicbox: {
    transpose: 12,
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 4, gain: 0.12, decay: 0.22 },
      { ratio: 6.8, gain: 0.04, decay: 0.07 },
    ],
    env: { attack: 0.002, decay: 1.1, sustain: 0, release: 0.9 },
    gain: 0.36,
  },
  marimba: {
    transpose: 0,
    // A wooden bar's overtones sit near 4× and 10×, and die almost at once.
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 3.93, gain: 0.3, decay: 0.1 },
      { ratio: 9.2, gain: 0.06, decay: 0.03 },
    ],
    env: { attack: 0.003, decay: 0.7, sustain: 0, release: 0.45 },
    strike: { gain: 0.6, decay: 0.025, mul: 2.5, q: 1.5 },
    gain: 0.5,
  },
  bells: {
    transpose: 12,
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2.76, gain: 0.3, decay: 0.8 },
      { ratio: 5.4, gain: 0.1, decay: 0.3 },
      { ratio: 8.93, gain: 0.035, decay: 0.1 },
    ],
    env: { attack: 0.002, decay: 2.2, sustain: 0, release: 1.6 },
    gain: 0.28,
  },
  flute: {
    transpose: 0,
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.22 },
      { ratio: 3, gain: 0.08 },
    ],
    env: { attack: 0.06, decay: 0.4, sustain: 0.75, release: 0.3 },
    breath: { gain: 0.6, q: 1 },
    filter: { mul: 3.5, max: 4500, q: 0.5 },
    vibrato: { rate: 5.3, cents: 14, delay: 0.25 },
    gain: 0.22,
  },
  pad: {
    transpose: 0,
    partials: [
      { ratio: 1, gain: 0.55, wave: "sawtooth", detune: -8 },
      { ratio: 1, gain: 0.55, wave: "sawtooth", detune: 8 },
      { ratio: 0.5, gain: 0.4 },
      { ratio: 2, gain: 0.12, wave: "triangle" },
    ],
    env: { attack: 0.32, decay: 0.8, sustain: 0.75, release: 1.5 },
    filter: { mul: 2.6, max: 2000, q: 0.3 },
    vibrato: { rate: 4.4, cents: 6, delay: 0.4 },
    gain: 0.24,
  },
  bubbles: {
    transpose: 0,
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.12, decay: 0.06 },
    ],
    env: { attack: 0.004, decay: 0.2, sustain: 0, release: 0.15 },
    glide: { from: 0.55, time: 0.07 },
    gain: 0.75,
  },
};
