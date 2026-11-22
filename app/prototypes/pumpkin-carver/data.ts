import { defineControls } from "@/lib/controls/schema";
import type { BodyDims, Op, Rgb, Variety } from "./types";

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
export const ELEVATION = 0.17;

/** Body half extents for the round pumpkin: face units are world units on this one. */
export const ROUND_DIMS: BodyDims = { a: 1, b: 0.8 };
export const SHAPE_DIMS: Record<"round" | "tall" | "squat", BodyDims> = {
  round: ROUND_DIMS,
  tall: { a: 0.86, b: 1 },
  squat: { a: 1.12, b: 0.64 },
};

/** Wall bevel: how far the inner opening sits from the outer cut, in face units. */
export const WALL = { shrink: 0.1, lift: 0.055, layers: 9 };
/** Etch is a broad scraper: this many knife widths. */
export const ETCH_WIDTH_FACTOR = 2.2;
/** Patch is a broad brush too: easy to fill a cut back in. */
export const PATCH_WIDTH_FACTOR = 2.6;
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
    default: 0.75,
    randomRange: [0.4, 1],
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
    default: 6,
    randomize: false,
  },
});

/** First visit: a classic face, pre-carved, so the page (and the thumbnail) glows. */
export const DEFAULT_OPS: Op[] = [{ t: "face", f: "jack" }];

/** Pumpkin colors offered by the swatch (content colors, applied to the controls). */
export const SWATCHES: { label: string; variety: Variety; hue: number; css: string }[] = [
  { label: "Classic", variety: "orange", hue: 24, css: "#e9731f" },
  { label: "Deep", variety: "orange", hue: 14, css: "#c9471a" },
  { label: "Golden", variety: "orange", hue: 34, css: "#eda233" },
  { label: "Ghost", variety: "ghost", hue: 24, css: "#e8e1cf" },
  { label: "Fairytale", variety: "fairytale", hue: 24, css: "#b9693f" },
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

// ─── The set: table, wall and out-of-focus pumpkins (content, not chrome) ─────────

/** Weathered table planks and the board wall behind, as RGB ranges. */
export const WOOD = {
  table: { light: [86, 70, 58] as Rgb, dark: [34, 27, 24] as Rgb, gap: [8, 6, 6] as Rgb },
  wall: { light: [58, 44, 36] as Rgb, dark: [22, 17, 15] as Rgb, gap: [6, 4, 4] as Rgb },
  /** Fallen leaves and seeds scattered on the table. */
  litter: [[168, 74, 26], [122, 52, 20], [190, 120, 48], [96, 64, 30]] as Rgb[],
};

/** Background pumpkins: world position on the table (hero at origin), scale, variety. */
export const PROPS: { x: number; z: number; scale: number; variety: Variety; hue: number; seed: number }[] = [
  { x: -1.75, z: -1.4, scale: 0.4, variety: "ghost", hue: 24, seed: 11 },
  { x: 2.05, z: -1.9, scale: 0.5, variety: "orange", hue: 20, seed: 23 },
  { x: -3.2, z: -3.4, scale: 0.62, variety: "orange", hue: 28, seed: 37 },
  { x: 3.4, z: 0.9, scale: 0.3, variety: "fairytale", hue: 24, seed: 51 },
  { x: -3.3, z: 1.2, scale: 0.34, variety: "ghost", hue: 24, seed: 64 },
];

/** Drifting dust / ember motes. */
export const MOTES = { count: 46, ember: [255, 176, 82] as Rgb, dust: [190, 196, 214] as Rgb };
