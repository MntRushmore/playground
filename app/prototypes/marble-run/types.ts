import type { ControlValues } from "@/lib/controls/schema";
import type { controls } from "./data";

export type Settings = ControlValues<typeof controls>;

export type PieceType =
  | "dropper"
  | "ramp"
  | "curve"
  | "funnel"
  | "switch"
  | "wheel"
  | "bumper"
  | "spring"
  | "lift"
  | "cup";

/** A placed piece, in world units. `angle` is in degrees, clockwise (screen y points down). */
export type Piece = {
  id: string;
  type: PieceType;
  x: number;
  y: number;
  angle: number;
  /** Mirror horizontally: reverses wheels and lifts, swaps curve and switch handedness. */
  flip: boolean;
};

export type StoredLayout = { version: number; pieces: Piece[] };

export type Vec = { x: number; y: number };

/** World → screen (CSS px): screen = world * scale + offset. */
export type View = { scale: number; ox: number; oy: number; width: number; height: number };

/** Rectangle or circle in a piece's local frame (before the piece's own rotation). */
export type Prim =
  | { k: "rect"; x: number; y: number; w: number; h: number; a: number; tag?: string }
  | { k: "circle"; x: number; y: number; r: number; tag?: string };

export type Rgb = readonly [number, number, number];

export type ThemeColors = {
  dark: boolean;
  background: Rgb;
  foreground: Rgb;
};

/** Live state of a piece that the renderer needs (spin, tilt, lift belt phase, flashes). */
export type PieceVisual = {
  piece: Piece;
  /** Wheel spin (rad) or switch tilt (rad), added to the piece angle. */
  turn: number;
  /** Lift belt travel in world units. */
  belt: number;
  /** 0..1, decays: bumper/cup glow, spring compression. */
  flash: number;
};

export type Marble = {
  id: number;
  color: number;
  radius: number;
  /** Interpolated render position + angle. */
  x: number;
  y: number;
  angle: number;
  /** ms since spawn (sim time). */
  age: number;
  /** ms since the marble started fading out; -1 while alive. */
  dying: number;
  /** -1..1 while orbiting a funnel: positive is behind the cone. 0 otherwise. */
  depth: number;
  trail: Vec[];
};

export type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: number };

export type Material = "glass" | "track" | "bumper" | "spring" | "cup" | "wheel" | "switch" | "lift";

export type SimEvent =
  | { kind: "hit"; material: Material; speed: number }
  | { kind: "cup" }
  | { kind: "flip" };

/** What a pointer is currently doing on the board. */
export type Ghost = { type: PieceType; x: number; y: number; angle: number; valid: boolean };
