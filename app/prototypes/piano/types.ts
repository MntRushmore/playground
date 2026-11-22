import type { ControlValues } from "@/lib/controls/schema";
import type { controls } from "./data";

export type PianoSettings = ControlValues<typeof controls>;
export type PresetId = PianoSettings["sound"];
export type ThemeId = PianoSettings["theme"];
export type LabelMode = PianoSettings["labels"];

// ── Sound ────────────────────────────────────────────────────────────────

/** One sine/triangle/saw partial of a voice, relative to the note's frequency. */
export type Overtone = {
  ratio: number;
  gain: number;
  wave?: OscillatorType;
  /** Cents, for gentle chorus between layers. */
  detune?: number;
  /** Own decay (s, like Envelope.decay). Higher partials fading first is what makes a tone warm. */
  decay?: number;
};

/** ADSR in seconds. `decay` = time to fall most of the way to `sustain`; `sustain: 0` rings out by itself. */
export type Envelope = { attack: number; decay: number; sustain: number; release: number };

export type Preset = {
  /** Semitones added to the played note (a music box sounds an octave up). */
  transpose: number;
  partials: Overtone[];
  env: Envelope;
  /** Low-pass per voice: cutoff = note frequency × `mul`, capped at `max`; optional brightness envelope. */
  filter?: { mul: number; max: number; q?: number; peakMul?: number; decay?: number };
  vibrato?: { rate: number; cents: number; delay: number };
  /** Pitch slides up from `from` × frequency over `time` seconds (a bubble "bloop"). */
  glide?: { from: number; time: number };
  /** Short band-passed noise "thump" at the start: a hammer or mallet hitting. Center = note frequency × `mul`. */
  strike?: { gain: number; decay: number; mul: number; q: number };
  /** Soft air noise around the note, for wind-like presets. */
  breath?: { gain: number; q: number };
  /** Loudness trim so presets sit at a similar level. */
  gain: number;
};

// ── Color ────────────────────────────────────────────────────────────────

/** OKLCH lightness (0–1), chroma, hue (deg). */
export type Lch = readonly [number, number, number];

export type ColorTheme = {
  /** One color per white note, C D E F G A B. Black keys blend their neighbours. */
  notes: readonly [Lch, Lch, Lch, Lch, Lch, Lch, Lch];
};

// ── Layout ───────────────────────────────────────────────────────────────

export type KeyLayout = {
  /** Unique within the keyboard (the same note may appear at the end of one row and the start of the next). */
  id: string;
  midi: number;
  black: boolean;
  /** Percent of the row width. */
  left: number;
  width: number;
  /** Percent of the row height. */
  height: number;
};

export type RowLayout = { id: string; keys: KeyLayout[]; whiteCount: number };

export type KeyboardLayout = { rows: RowLayout[] };

export type Size = { width: number; height: number };
