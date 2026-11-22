import type { ControlValues } from "@/lib/controls/schema";
import type { controls } from "./data";

export type FlowSettings = ControlValues<typeof controls>;

export type Particle = {
  x: number;
  y: number;
  /** Previous position, for drawing the segment travelled this frame. */
  px: number;
  py: number;
  age: number;
  life: number;
  /** Flow angle at the current position (radians), used for spectrum color. */
  angle: number;
};

export type Bounds = { width: number; height: number };

export type ThemeColors = { background: string; foreground: string; dark: boolean };
