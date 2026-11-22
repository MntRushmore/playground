import { defineControls } from "@/lib/controls/schema";
import type { Instrument, Layout } from "./types";

export const SLUG = "marble-music";

/** Device pixel ratio cap: sharper beyond 2 isn't worth the fill cost. */
export const MAX_DPR = 2;

/** Bars are tuned to one of this many scale degrees (0 = longest, lowest). */
export const DEGREE_COUNT = 12;

export const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

export const SCALES = {
  majorPentatonic: { label: "Major pentatonic", steps: [0, 2, 4, 7, 9] },
  minorPentatonic: { label: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
  hirajoshi: { label: "Hirajoshi", steps: [0, 2, 3, 7, 8] },
  lydian: { label: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
  dorian: { label: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
  major: { label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
} as const;

/**
 * Additive voices: each partial is [frequency ratio, relative gain, decay seconds].
 * Upper partials decay fast, which is what makes a struck bar sound struck.
 */
export const INSTRUMENTS: Record<string, Instrument> = {
  marimba: {
    octave: 3,
    attack: 0.003,
    gain: 1.15,
    click: 0.5,
    partials: [
      [1, 1, 1.1],
      [3.93, 0.22, 0.16],
      [9.21, 0.05, 0.04],
    ],
  },
  kalimba: {
    octave: 4,
    attack: 0.002,
    gain: 0.95,
    click: 0.25,
    partials: [
      [1, 1, 1.8],
      [1.004, 0.35, 1.5],
      [2.01, 0.07, 0.5],
      [5.95, 0.22, 0.14],
    ],
  },
  glass: {
    octave: 4,
    attack: 0.004,
    gain: 0.8,
    click: 0,
    partials: [
      [1, 1, 3.2],
      [2.76, 0.36, 1.6],
      [5.4, 0.18, 0.8],
      [8.93, 0.09, 0.35],
    ],
  },
  musicBox: {
    octave: 5,
    attack: 0.001,
    gain: 0.75,
    click: 0.12,
    partials: [
      [1, 1, 1.4],
      [2, 0.12, 0.7],
      [4.0, 0.24, 0.3],
    ],
  },
};

/** Note hues from low (warm) to high (cool), one per degree. Content palette, works on both themes. */
export const DEGREE_HUES = [22, 42, 68, 100, 140, 168, 192, 214, 240, 266, 296, 328];

/** oklch lightness/chroma per theme so pitch colors read on dark and light backgrounds. */
export const NOTE_TONE = {
  dark: { l: 0.79, c: 0.14 },
  light: { l: 0.63, c: 0.16 },
};

export const GEOMETRY = {
  /** Bar length range as a fraction of the canvas's shorter side. */
  maxLength: 0.36,
  minLength: 0.1,
  thickness: 0.024,
  minThickness: 8,
  maxThickness: 15,
  marbleRadius: 0.0165,
  minMarble: 5,
  maxMarble: 11,
  /**
   * Widest stage aspect (w/h). Layouts live in a centered stage so a machine plays the
   * same on a phone and a wide monitor instead of stretching sideways.
   */
  stageAspect: 1.1,
  /** Distance from bar end to the rotate / delete knobs (px). */
  knobGap: 22,
  knobRadius: 12,
  /** Extra touch slop around bars and knobs (px). */
  hitSlop: 12,
};

export const PHYSICS = {
  stepMs: 1000 / 120,
  maxSubsteps: 8,
  /** Gravity in px/ms² at 1× and the reference canvas height. */
  gravityScale: 0.0011,
  refHeight: 760,
  maxMarbles: 44,
  /** Marbles slower than this (px/s) for stillSeconds fade out. */
  stillSpeed: 14,
  stillSeconds: 2.2,
  maxAgeSeconds: 40,
  fadeSeconds: 0.45,
  /** Emitter drop period multipliers: 2:3:4 polyrhythm between emitters. */
  emitterRatios: [1, 1.5, 2],
  /** First drops after load (seconds), staggered so the scene comes alive quickly. */
  firstDrops: [0.25, 0.85, 1.4],
};

export const SOUND = {
  maxVoices: 14,
  /** Ignore re-hits of the same marble on the same bar within this window (s). */
  pairCooldown: 0.09,
  barCooldown: 0.04,
  /** Impact speed (px/s at reference height) below which nothing plays. */
  minImpact: 45,
  latency: 0.015,
  reverbSeconds: 2.8,
};

export const controls = defineControls({
  instrument: {
    type: "select",
    label: "Instrument",
    options: ["marimba", "kalimba", "glass", "musicBox"],
    optionLabels: { marimba: "Marimba", kalimba: "Kalimba", glass: "Glass bells", musicBox: "Music box" },
    default: "marimba",
  },
  scale: {
    type: "select",
    label: "Scale",
    options: ["majorPentatonic", "minorPentatonic", "hirajoshi", "lydian", "dorian", "major"],
    optionLabels: Object.fromEntries(Object.entries(SCALES).map(([k, v]) => [k, v.label])),
    default: "majorPentatonic",
  },
  key: { type: "select", label: "Key", options: KEYS, default: "D" },
  reverb: {
    type: "number",
    label: "Reverb",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
    randomRange: [0.15, 0.7],
    format: (v) => `${Math.round(v * 100)}%`,
  },
  dropRate: {
    type: "number",
    label: "Drop rate",
    min: 6,
    max: 90,
    step: 1,
    default: 30,
    randomRange: [16, 54],
    format: (v) => `${v}/min`,
  },
  emitters: { type: "number", label: "Emitters", min: 1, max: 3, step: 1, default: 2 },
  gravity: {
    type: "number",
    label: "Gravity",
    min: 0.3,
    max: 2,
    step: 0.05,
    default: 1,
    randomRange: [0.6, 1.4],
    format: (v) => `${v.toFixed(2)}×`,
  },
  bounce: {
    type: "number",
    label: "Bounciness",
    min: 0.1,
    max: 0.95,
    step: 0.01,
    default: 0.6,
    randomRange: [0.4, 0.85],
    format: (v) => `${Math.round(v * 100)}%`,
  },
  marbleSize: {
    type: "number",
    label: "Marble size",
    min: 0.5,
    max: 2,
    step: 0.05,
    default: 1,
    randomRange: [0.7, 1.5],
    format: (v) => `${v.toFixed(2)}×`,
  },
  wander: {
    type: "number",
    label: "Wander",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.2,
    randomRange: [0, 0.6],
    format: (v) => `${Math.round(v * 100)}%`,
  },
  trails: { type: "boolean", label: "Trails", default: true },
  volume: {
    type: "number",
    label: "Volume",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.8,
    randomize: false,
    format: (v) => `${Math.round(v * 100)}%`,
  },
});

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Starting machine: two crossing cascades ending on a long bass bar. Hand-designed, then
 * nudged with a headless simulation so every bar gets played on phones and desktops.
 */
export const DEFAULT_LAYOUT: Layout = {
  emitters: [
    { x: 0.36, y: 0.06 },
    { x: 0.64, y: 0.06 },
    { x: 0.5, y: 0.06 },
  ],
  bars: [
    { id: "b1", x: 0.348, y: 0.215, angle: deg(26), degree: 10 },
    { id: "b2", x: 0.674, y: 0.272, angle: deg(-22), degree: 8 },
    { id: "b3", x: 0.484, y: 0.395, angle: deg(-14.5), degree: 6 },
    { id: "b4", x: 0.231, y: 0.469, angle: deg(34), degree: 7 },
    { id: "b5", x: 0.794, y: 0.482, angle: deg(-28), degree: 9 },
    { id: "b6", x: 0.349, y: 0.572, angle: deg(-16), degree: 4 },
    { id: "b7", x: 0.611, y: 0.628, angle: deg(12.5), degree: 5 },
    { id: "b8", x: 0.219, y: 0.693, angle: deg(20.5), degree: 2 },
    { id: "b9", x: 0.84, y: 0.812, angle: deg(-19.5), degree: 3 },
    { id: "b10", x: 0.515, y: 0.867, angle: deg(14), degree: 0 },
  ],
};
