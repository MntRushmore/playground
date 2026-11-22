import { defineControls } from "@/lib/controls/schema";

export const SLUG = "piano";

// ── Controls ─────────────────────────────────────────────────────────────

const SOUNDS = ["piano", "musicbox", "marimba", "bells", "flute", "pad", "bubbles"] as const;
const THEMES = ["rainbow", "candy", "ocean", "sunset", "jungle", "galaxy"] as const;

export const controls = defineControls({
  sound: {
    type: "select",
    label: "Sound",
    options: SOUNDS,
    optionLabels: {
      piano: "Soft piano",
      musicbox: "Music box",
      marimba: "Marimba",
      bells: "Bells",
      flute: "Flute",
      pad: "Warm pad",
      bubbles: "Bubbles",
    },
    default: "piano",
  },
  theme: {
    type: "select",
    label: "Colors",
    options: THEMES,
    optionLabels: {
      rainbow: "Rainbow",
      candy: "Candy",
      ocean: "Ocean",
      sunset: "Sunset",
      jungle: "Jungle",
      galaxy: "Galaxy",
    },
    default: "rainbow",
  },
  octaves: {
    type: "number",
    label: "Octaves",
    min: 1,
    max: 3,
    step: 1,
    default: 2,
  },
  startOctave: {
    type: "number",
    label: "Lowest note",
    min: 2,
    max: 5,
    step: 1,
    default: 4,
    format: (v) => `C${v}`,
    randomRange: [3, 5],
  },
  blackKeys: { type: "boolean", label: "Black keys", default: true },
  labels: {
    type: "select",
    label: "Note names",
    options: ["none", "letters", "solfege"],
    optionLabels: { none: "Off", letters: "C D E", solfege: "Do Re Mi" },
    default: "letters",
  },
  reverb: {
    type: "number",
    label: "Echo",
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.35,
    format: (v) => `${Math.round(v * 100)}%`,
    randomRange: [0.15, 0.6],
  },
  volume: {
    type: "number",
    label: "Volume",
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.8,
    format: (v) => `${Math.round(v * 100)}%`,
    // Never let Surprise-me make it suddenly loud.
    randomize: false,
  },
});

/** Voices beyond this steal the oldest (ten fingers + ringing tails). */
export const MAX_VOICES = 22;
/** A tap shorter than this still sounds for this long (s). */
export const MIN_NOTE = 0.12;
/** Notes above this are gently turned down so high keys never get shrill (Hz). */
export const LOUDNESS_KNEE = 900;

// ── Notes & keys ────────────────────────────────────────────────────────

export const LETTER_NAMES = ["C", "D", "E", "F", "G", "A", "B"] as const;
export const SOLFEGE_NAMES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"] as const;

/** Computer keyboard (physical key codes) → semitones above the lowest C on screen. */
export const KEY_CODES: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
};

/**
 * Black key size relative to a white key: slimmer when white keys are narrow (portrait phones),
 * and never taller than `maxAspect` × its white key's width, so very tall rows keep a big white area.
 */
export const BLACK_KEY = {
  width: 0.58,
  narrowWidth: 0.5,
  narrowBelowPx: 60,
  height: 0.6,
  minHeight: 0.4,
  maxAspect: 5,
};

/** Classic slight offsets of black keys from the white-key seam, in white-key widths. */
export const BLACK_OFFSETS: Record<number, number> = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 };

/** White-key height ÷ width the row chooser aims for: chunky, kid-sized keys. */
export const TARGET_KEY_ASPECT = 4;
/** White keys narrower than this (px) are too fiddly for small fingers. */
export const MIN_KEY_WIDTH = 40;

/** Space kept clear for the floating controls button on phones (px). */
export const FAB_CLEARANCE = { bottom: 68, side: 72 };

// ── Floating shapes (24×24 paths) ───────────────────────────────────────

export const PARTICLE_SHAPES = [
  // eighth note
  "M8.5 14a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M10.6 3h2.2v14.5h-2.2z M12.8 3c.6 3 4.7 3.6 4.7 7.6-1-1.6-2.7-2.4-4.7-2.6z",
  // two beamed notes
  "M6 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M16 13a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M7.4 6.6h1.8V18H7.4z M17.4 4.6h1.8V16h-1.8z M7.4 6.6 19.2 3.6v3L7.4 9.6z",
  // star
  "M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z",
  // heart
  "M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z",
  // dot
  "M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z",
] as const;

/** Most shapes alive at once; older ones are dropped first. */
export const MAX_PARTICLES = 48;
