import type { ControlValues } from "@/lib/controls/schema";
import type { controls } from "./data";

export type Settings = ControlValues<typeof controls>;

/** A tuned bar, stored in normalized canvas coordinates (0..1) so layouts scale. */
export type Bar = {
  id: string;
  x: number;
  y: number;
  /** Radians, canvas convention (positive = clockwise, right end lower). */
  angle: number;
  /** Scale degree 0..DEGREE_COUNT-1; sets length (pitch) and color. */
  degree: number;
};

export type Emitter = { x: number; y: number };

export type Layout = { bars: Bar[]; emitters: Emitter[] };

export type Size = { width: number; height: number };

/** A bar resolved to pixels for the current canvas. */
export type BarGeom = {
  cx: number;
  cy: number;
  angle: number;
  length: number;
  thickness: number;
};

export type Instrument = {
  /** Octave of degree 0 (4 → the key's note around middle C). */
  octave: number;
  attack: number;
  gain: number;
  /** [frequency ratio, relative gain, decay seconds] (decays are for ~330 Hz; lower notes ring longer) */
  partials: [number, number, number][];
  /** Level of the short filtered-noise "mallet" transient (0 = none). */
  click: number;
};

export type ThemeColors = {
  background: string;
  foreground: string;
  font: string;
  dark: boolean;
};

/** A bar strike, from physics or a tap, ready for the audio engine. */
export type NoteEvent = {
  freq: number;
  /** 0..1, from impact speed. */
  velocity: number;
  /** -1..1 stereo position from x. */
  pan: number;
  /** Seconds after "now" so substep timing is preserved. */
  delay: number;
  instrument: Settings["instrument"];
};

/** Physics contact between a marble and a bar. */
export type Contact = {
  barId: string;
  marbleId: number;
  /** Normal impact speed in px/s. */
  speed: number;
  x: number;
  y: number;
  /** Unit normal pointing from the bar toward the marble. */
  nx: number;
  ny: number;
};

export type Ripple = { x: number; y: number; degree: number; age: number; life: number; radius: number };

export type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  degree: number;
};

/** Per-bar visual state (not persisted). */
export type BarFx = {
  glow: number;
  wobble: number;
  phase: number;
  /** 0..1 grow-in animation. */
  appear: number;
  delay: number;
};

export type MarbleState = {
  id: number;
  radius: number;
  /** Degree of the last bar hit (tints the marble) or null when fresh. */
  degree: number | null;
  flash: number;
  age: number;
  still: number;
  /** 1 = fully visible; counts down to 0 once fading. */
  fade: number;
  fading: boolean;
  trail: { x: number; y: number }[];
  /** Sim time of the last hit per bar id, to debounce rattles. */
  hits: Map<string, number>;
};
