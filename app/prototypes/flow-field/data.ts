import { defineControls } from "@/lib/controls/schema";

export const SLUG = "flow-field";

/** Device pixel ratio cap: sharper beyond 2 isn't worth the fill cost. */
export const MAX_DPR = 2;

/** Hue buckets used to batch strokes in spectrum mode (one path per bucket). */
export const HUE_BUCKETS = 24;

/** Static render used when prefers-reduced-motion is set. */
export const STILL_FRAME = { maxParticles: 700, steps: 140 };

export const controls = defineControls({
  count: { type: "number", label: "Particles", min: 200, max: 4000, step: 100, default: 1600 },
  speed: { type: "number", label: "Speed", min: 0.2, max: 4, step: 0.1, default: 1.2 },
  scale: {
    type: "number",
    label: "Zoom",
    min: 0.5,
    max: 8,
    step: 0.1,
    default: 2.4,
    randomRange: [1, 5],
  },
  turbulence: { type: "number", label: "Turbulence", min: 0.5, max: 4, step: 0.1, default: 1.4 },
  evolution: { type: "number", label: "Evolution", min: 0, max: 2, step: 0.05, default: 0.35 },
  trails: {
    type: "number",
    label: "Trails",
    min: 0,
    max: 0.96,
    step: 0.01,
    default: 0.9,
    randomRange: [0.7, 0.96],
  },
  palette: {
    type: "select",
    label: "Palette",
    options: ["spectrum", "tint", "mono"],
    optionLabels: { spectrum: "Spectrum", tint: "Tint", mono: "Mono" },
    default: "spectrum",
  },
  tint: { type: "color", label: "Tint", default: "#8b5cf6", when: (v) => v.palette === "tint" },
  seed: { type: "number", label: "Seed", min: 1, max: 9999, step: 1, default: 42 },
});
