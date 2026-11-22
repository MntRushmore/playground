import { defineControls } from "@/lib/controls/schema";
import type { PieceType } from "./types";

export const SLUG = "marble-run";

/** Board size in world units. Pieces are stored in these units, so layouts survive any screen. */
export const WORLD = { width: 1000, height: 1250 } as const;

/** Bump when the stored layout shape changes; older layouts fall back to the default run. */
export const LAYOUT_VERSION = 1;
export const MAX_PIECES = 80;
export const MAX_HISTORY = 60;

export const GRID = 25;
export const ANGLE_SNAP = 15;
/** Track ends within this distance (world units) click together. */
export const CONNECT_RADIUS = 34;

/** Physics runs in fixed sub-steps (240 Hz) so fast marbles never tunnel through 14-unit tracks. */
export const SUB_DT = 1000 / 240;
export const MAX_SUBSTEPS = 24;
/** Sim time simulated instantly on load, so the default run is already rolling. */
export const WARMUP_MS = 4500;

/** Gravity at 1g, in world units per second squared. */
export const GRAVITY = 1500;
export const MAX_SPEED = 2800;
export const TRACK = 14;

export const MAX_DPR = 2;
/** How long a retired marble takes to fade out. */
export const FADE_MS = 380;

/** Glass marbles: [tint, cat's-eye vane]. Clear glass tints with a bright inner twist. */
export const MARBLE_COLORS: readonly (readonly [string, string])[] = [
  ["#3d8bff", "#ffd23f"],
  ["#ff5a4e", "#ffffff"],
  ["#20b58a", "#ff7a1a"],
  ["#f2b632", "#2a6cff"],
  ["#8f6bff", "#7fffd4"],
  ["#ff6fa3", "#fff1a8"],
  ["#5fbf3f", "#ff4f6d"],
  ["#c9d6e3", "#ff3b3b"],
];

/**
 * Molded-plastic kit colors. These are content (the toy's own colors), identical in both
 * themes; only the backdrop follows the theme.
 */
export const PLASTIC = {
  red: "#e42a2f",
  blue: "#1f62d6",
  green: "#1d9a42",
  yellow: "#ffc81a",
  orange: "#ff7b14",
  steel: "#a7b0ba",
} as const;
export type PlasticName = keyof typeof PLASTIC;

/** Column segments cycle through these, like stacked tube pieces. */
export const BAND_ORDER: readonly PlasticName[] = ["red", "blue", "green", "yellow"];

/** Colors a piece type may be molded in; each piece picks one from its id. */
export const PIECE_PLASTIC: Record<PieceType, readonly PlasticName[]> = {
  dropper: ["orange"],
  ramp: ["red", "yellow", "blue", "green"],
  curve: ["yellow", "blue", "red"],
  funnel: ["blue", "green"],
  switch: ["green", "blue"],
  wheel: ["yellow", "green"],
  bumper: ["red", "orange"],
  spring: ["green"],
  lift: ["yellow"],
  cup: ["green", "red", "yellow"],
};

/** Palette order. */
export const PIECE_TYPES: readonly PieceType[] = [
  "dropper",
  "ramp",
  "curve",
  "funnel",
  "switch",
  "wheel",
  "bumper",
  "spring",
  "lift",
  "cup",
];

export const PIECE_LABELS: Record<PieceType, string> = {
  dropper: "Dropper",
  ramp: "Track",
  curve: "Curve",
  funnel: "Funnel",
  switch: "Switch",
  wheel: "Wheel",
  bumper: "Bumper",
  spring: "Spring",
  lift: "Lift",
  cup: "Cup",
};

/** Pieces whose Mirror action changes behaviour (direction or handedness). */
export const MIRRORABLE: ReadonlySet<PieceType> = new Set(["curve", "switch", "wheel", "lift"]);

/** Starting angle when a piece is dropped from the palette. */
export const PLACE_ANGLE: Partial<Record<PieceType, number>> = { ramp: 15 };

export const controls = defineControls({
  gravity: {
    type: "number",
    label: "Gravity",
    min: 0.3,
    max: 2.5,
    step: 0.05,
    default: 1,
    randomRange: [0.7, 1.5],
    format: (v) => `${v.toFixed(2)}g`,
  },
  release: {
    type: "number",
    label: "Release rate",
    min: 0.2,
    max: 4,
    step: 0.1,
    default: 1.1,
    randomRange: [0.6, 2.4],
    format: (v) => `${v.toFixed(1)}/s`,
  },
  count: {
    type: "number",
    label: "Marbles",
    min: 1,
    max: 40,
    step: 1,
    default: 12,
    randomRange: [8, 28],
  },
  size: {
    type: "number",
    label: "Marble size",
    min: 11,
    max: 21,
    step: 1,
    default: 16,
    randomRange: [13, 19],
  },
  bounce: {
    type: "number",
    label: "Bounciness",
    min: 0,
    max: 0.8,
    step: 0.05,
    default: 0.25,
    randomRange: [0.1, 0.55],
  },
  friction: {
    type: "number",
    label: "Friction",
    min: 0,
    max: 0.3,
    step: 0.01,
    default: 0.06,
    randomRange: [0.02, 0.14],
  },
  motors: {
    type: "number",
    label: "Motor speed",
    min: 0.25,
    max: 2,
    step: 0.05,
    default: 1,
    randomRange: [0.6, 1.6],
    format: (v) => `${v.toFixed(2)}×`,
  },
  timeScale: {
    type: "number",
    label: "Time",
    min: 0.25,
    max: 2,
    step: 0.05,
    default: 1,
    randomRange: [0.6, 1.4],
    format: (v) => `${v.toFixed(2)}×`,
  },
  trails: { type: "boolean", label: "Trails", default: true },
  snap: { type: "boolean", label: "Snap to grid", default: true, randomize: false },
  sound: { type: "boolean", label: "Sound", default: false, randomize: false },
});
