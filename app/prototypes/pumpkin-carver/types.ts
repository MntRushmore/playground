import type { ControlValues } from "@/lib/controls/schema";
import type { controls } from "./data";
import type { FACES } from "./faces";
import type { SHAPES } from "./shapes";

export type Settings = ControlValues<typeof controls>;
export type PumpkinShape = Settings["shape"];
export type Variety = Settings["variety"];

/** Carve cuts through, Etch thins the skin, Patch fills carved areas back in. */
export type Tool = "carve" | "etch" | "patch";
export type ShapeId = keyof typeof SHAPES;
export type FaceId = keyof typeof FACES;

/**
 * Carving operations, in "face" units: world units on the round pumpkin, origin at the
 * body center, y pointing down. Other shapes stretch the face to fit (see faceTransform).
 */
export type StrokeOp = {
  t: "cut" | "etch" | "patch";
  /** Line width in face units. */
  w: number;
  /** Flat [x0, y0, x1, y1, …]. */
  p: number[];
};

/** One chiseled shape (an eye, a mouth…) placed on the face. */
export type StampOp = {
  t: "stamp";
  s: ShapeId;
  x: number;
  y: number;
  /** Half-size in face units. */
  k: number;
  /** Mirror horizontally. */
  f?: boolean;
};

/** A one-tap face preset: replaces the carving with the preset's shapes. */
export type FaceOp = { t: "face"; f: FaceId };
export type ClearOp = { t: "clear" };

export type Op = StrokeOp | StampOp | FaceOp | ClearOp;
/** What actually gets painted after expanding faces and clears. */
export type PaintOp = StrokeOp | StampOp;

export type Pt = [number, number];
export type ShapeDef = {
  /** Outline in a [-1, 1] box, y down. */
  outer: Pt[];
  /** Islands of skin left inside the cut (a ghost's eyes, a cat's pupil). */
  holes?: Pt[][];
};

export type Rgb = [number, number, number];

/** Candle light colors for a given warmth. */
export type GlowPalette = {
  core: Rgb;
  mid: Rgb;
  deep: Rgb;
  ember: Rgb;
  wallOuter: Rgb;
  wallInner: Rgb;
};

/** Skin and flesh colors for one variety (0–1 HSL for the skin, RGB for flesh). */
export type SkinPalette = {
  base: [number, number, number];
  top: [number, number, number];
  crease: [number, number, number];
  flesh: Rgb;
  fleshShade: Rgb;
  rind: Rgb;
};

/** Body half extents in world units. */
export type BodyDims = { a: number; b: number };

/** The rendered hero pumpkin, one canvas per layer, all `size`×`size` device px. */
export type PumpkinPlates = {
  size: number;
  /** Room lights on (warm dusk interior). */
  bodyDay: HTMLCanvasElement;
  /** Lights off: cool moonlight. */
  bodyNight: HTMLCanvasElement;
  /** Lit from the front by the candle's own glow (blended in with the flame). */
  bodyGlow: HTMLCanvasElement;
  stemDay: HTMLCanvasElement;
  stemNight: HTMLCanvasElement;
};

/** Pre-rendered set (table, wall, background pumpkins) at canvas size, day and night. */
export type SetLayers = {
  day: HTMLCanvasElement;
  night: HTMLCanvasElement;
  /** The set lit warm around the pumpkin, added in proportion to the candle light. */
  warm: HTMLCanvasElement;
};

/** Live state the frame renderer reads every tick. */
export type FrameState = {
  /** 0 = room lights on, 1 = lights off (animated). */
  dark: number;
  /** 0 = candle out, 1 = fully lit (animated). */
  flame: number;
  intensity: number;
  sway: number;
  stretch: number;
  /** Seconds, for motes and grain. */
  time: number;
  /** False with reduced motion: motes and grain hold still. */
  moving: boolean;
};

export type ThemeColors = { background: string; foreground: string; night: string; dark: boolean };
