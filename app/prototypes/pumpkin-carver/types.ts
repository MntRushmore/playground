import type { ControlValues } from "@/lib/controls/schema";
import type { controls, STAMPS } from "./data";

export type Settings = ControlValues<typeof controls>;
export type PumpkinShape = Settings["shape"];
export type Variety = Settings["variety"];

export type Tool = "knife" | "etch" | "stamp";
export type StampId = keyof typeof STAMPS;

/**
 * Carving operations, in "face" units: world units on the round pumpkin, origin at the
 * body center, y pointing down. Other shapes stretch the face to fit (see faceScale).
 */
export type StrokeOp = {
  t: "cut" | "etch";
  /** Line width in face units. */
  w: number;
  /** Flat [x0, y0, x1, y1, …]. */
  p: number[];
  /** Also carve the mirror image across the vertical center line. */
  m?: boolean;
};

export type StampOp = {
  t: "stamp";
  s: StampId;
  x: number;
  y: number;
  /** Half-size of the stamp's box in face units. */
  k: number;
  m?: boolean;
};

export type ClearOp = { t: "clear" };

export type Op = StrokeOp | StampOp | ClearOp;

export type StampDef = {
  label: string;
  /** SVG path data in a [-1, 1] box, y down. Drawn for the viewer's left side. */
  path: string;
  /** Default half-size in face units (before the Stamp size control). */
  size: number;
  /** Flip horizontally when placed right of center, so pairs mirror naturally. */
  handed?: boolean;
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

/** The rendered pumpkin, one canvas per layer, all `size`×`size` device px. */
export type PumpkinPlates = {
  size: number;
  bodyDay: HTMLCanvasElement;
  bodyNight: HTMLCanvasElement;
  stemDay: HTMLCanvasElement;
  stemNight: HTMLCanvasElement;
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
};

export type ThemeColors = { background: string; foreground: string; night: string; dark: boolean };
