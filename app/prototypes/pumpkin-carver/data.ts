import { defineControls } from "@/lib/controls/schema";
import type { BodyDims, Op, Rgb, StampDef } from "./types";

export const SLUG = "pumpkin-carver";

/** Device pixel ratio cap for the canvas and the rendered pumpkin. */
export const MAX_DPR = 2;
/** Upper bound on the pumpkin plate's size in device px (fill cost on big screens). */
export const MAX_PLATE_PX = 1400;
/** Export resolution for "Save image". */
export const EXPORT_PLATE_PX = 1500;

/** Plate framing in world units: x ∈ [-E, E], y ∈ [-E + OY, E + OY] (y up). */
export const PLATE = { E: 1.3, OY: 0.2 };
/** Camera looks down at the pumpkin by this angle (radians). */
export const ELEVATION = 0.22;

/** Body half extents for the round pumpkin: face units are world units on this one. */
export const ROUND_DIMS: BodyDims = { a: 1, b: 0.8 };
export const SHAPE_DIMS: Record<"round" | "tall" | "squat", BodyDims> = {
  round: ROUND_DIMS,
  tall: { a: 0.86, b: 1 },
  squat: { a: 1.12, b: 0.64 },
};

/** Wall bevel: how far the inner opening sits from the outer cut, in face units. */
export const WALL = { shrink: 0.05, lift: 0.026, layers: 7 };
/** Etch is a broad scraper: this many knife widths. */
export const ETCH_WIDTH_FACTOR = 2.4;
/** Knife width control → face units. */
export const KNIFE_UNIT = 0.011;
/** Candle position behind the mouth, face units. */
export const CANDLE = { x: 0, top: 0.56, width: 0.17, height: 0.3 };

export const controls = defineControls({
  shape: {
    type: "select",
    label: "Shape",
    options: ["round", "tall", "squat"],
    optionLabels: { round: "Round", tall: "Tall", squat: "Squat" },
    default: "round",
  },
  variety: {
    type: "select",
    label: "Variety",
    options: ["orange", "ghost", "fairytale"],
    optionLabels: { orange: "Orange", ghost: "Ghost", fairytale: "Fairytale" },
    default: "orange",
  },
  hue: {
    type: "number",
    label: "Hue",
    min: 8,
    max: 42,
    step: 1,
    default: 24,
    randomRange: [14, 34],
    format: (v) => `${v}°`,
    when: (v) => v.variety === "orange",
  },
  ribs: { type: "number", label: "Ribs", min: 7, max: 16, step: 1, default: 11 },
  ribDepth: {
    type: "number",
    label: "Rib depth",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.55,
    randomRange: [0.25, 0.9],
  },
  seed: { type: "number", label: "Variation", min: 1, max: 999, step: 1, default: 7 },
  warmth: {
    type: "number",
    label: "Candle warmth",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.55,
    randomRange: [0.2, 1],
  },
  flicker: { type: "number", label: "Flicker", min: 0, max: 1, step: 0.01, default: 0.55 },
  glow: {
    type: "number",
    label: "Glow",
    min: 0.2,
    max: 1.6,
    step: 0.05,
    default: 1,
    randomRange: [0.75, 1.4],
  },
  knife: {
    type: "number",
    label: "Knife width",
    min: 1,
    max: 10,
    step: 0.5,
    default: 4.5,
    randomize: false,
  },
  stampSize: {
    type: "number",
    label: "Stamp size",
    min: 0.6,
    max: 1.6,
    step: 0.05,
    default: 1,
    randomize: false,
    format: (v) => `${v.toFixed(2)}×`,
  },
});

/** Stamp shapes, drawn for the viewer's left side; `handed` ones flip on the right. */
export const STAMPS = {
  tri: {
    label: "Triangle eye",
    path: "M -0.95 0.72 Q 0 0.98 0.95 0.8 Q 0.58 -0.02 0.24 -0.92 Q -0.32 -0.1 -0.95 0.72 Z",
    size: 0.2,
    handed: true,
  },
  almond: {
    label: "Almond eye",
    path: "M -1 0.18 Q -0.3 -1.05 1 -0.12 Q 0.15 0.95 -1 0.18 Z",
    size: 0.19,
    handed: true,
  },
  angry: {
    label: "Angry eye",
    path: "M -1 -0.42 L 1 0.12 Q 0.9 0.88 0.05 0.86 Q -0.92 0.8 -1 -0.42 Z",
    size: 0.2,
    handed: true,
  },
  nose: {
    label: "Nose",
    path: "M 0 -0.95 Q 0.42 -0.1 0.85 0.72 Q 0 0.98 -0.85 0.72 Q -0.42 -0.1 0 -0.95 Z",
    size: 0.1,
  },
  grin: {
    label: "Toothy grin",
    path:
      "M -1 -0.5 Q -0.72 -0.1 -0.44 -0.02 L -0.42 0.3 L -0.17 0.36 L -0.15 0.06 " +
      "Q 0 0.09 0.15 0.06 L 0.17 0.36 L 0.42 0.3 L 0.44 -0.02 Q 0.72 -0.1 1 -0.5 " +
      "Q 0.78 0.86 0 0.9 Q -0.78 0.86 -1 -0.5 Z",
    size: 0.42,
  },
  smile: {
    label: "Smile",
    path: "M -1 -0.42 Q 0 0.32 1 -0.42 Q 0.66 0.9 0 0.92 Q -0.66 0.9 -1 -0.42 Z",
    size: 0.4,
  },
  oh: {
    label: "Round mouth",
    path:
      "M 0 -1 C 0.58 -1 0.74 -0.36 0.74 0.04 C 0.74 0.6 0.42 1 0 1 " +
      "C -0.42 1 -0.74 0.6 -0.74 0.04 C -0.74 -0.36 -0.58 -1 0 -1 Z",
    size: 0.16,
  },
} satisfies Record<string, StampDef>;

export const STAMP_ORDER = ["tri", "almond", "angry", "nose", "grin", "smile", "oh"] as const;

/** A classic face, pre-carved so the first visit (and the gallery thumbnail) glows. */
export const DEFAULT_OPS: Op[] = [
  { t: "stamp", s: "tri", x: -0.36, y: -0.22, k: 0.2, m: true },
  { t: "stamp", s: "nose", x: 0, y: -0.01, k: 0.1 },
  { t: "stamp", s: "grin", x: 0, y: 0.31, k: 0.43 },
  {
    t: "etch",
    w: 0.07,
    p: [-0.6, -0.42, -0.5, -0.5, -0.38, -0.53, -0.26, -0.51, -0.17, -0.45],
    m: true,
  },
];

// ─── Content palettes (the pumpkin is content, not UI chrome) ────────────────────

/** Scene darkness behind the pumpkin when the lights are off, per app theme. */
export const NIGHT_COLOR = { dark: "#040408", light: "#100d16" };

/** Candle light at warmth 0 (cool, buttery) and 1 (deep amber). */
export const GLOW_COOL: Record<"core" | "mid" | "deep" | "ember" | "wallOuter" | "wallInner", Rgb> = {
  core: [255, 252, 236],
  mid: [255, 214, 120],
  deep: [222, 140, 40],
  ember: [92, 52, 10],
  wallOuter: [232, 168, 64],
  wallInner: [255, 244, 206],
};
export const GLOW_WARM: typeof GLOW_COOL = {
  core: [255, 230, 176],
  mid: [255, 150, 44],
  deep: [184, 58, 10],
  ember: [62, 14, 4],
  wallOuter: [214, 96, 24],
  wallInner: [255, 200, 110],
};

/** Daylight wall ramp: pale cut edge → shadowed flesh deeper in. */
export const WALL_DAY = { inner: [176, 98, 30] as Rgb };
/** Interior of the pumpkin when the candle is out. */
export const CAVITY_DARK = { day: [70, 30, 10] as Rgb, deep: [22, 8, 3] as Rgb };
/** Candle wax. */
export const WAX = { light: [250, 238, 214] as Rgb, shade: [196, 168, 128] as Rgb };

/** Stem colors, base → tip, plus the cut face. */
export const STEM_COLORS = {
  base: [0.22, 0.42, 0.2],
  mid: [0.13, 0.32, 0.34],
  tip: [0.1, 0.3, 0.52],
  cut: [0.11, 0.35, 0.68],
} as const;
