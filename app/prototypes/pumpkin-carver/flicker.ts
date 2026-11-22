// Candle flicker: layered 1D noise plus occasional "drafts". Pure, time in seconds.
//
// A real flame isn't a sine: it breathes slowly, shivers quickly, and every so often a
// draft makes it gutter for a moment. We model that as three octaves of gradient noise
// for the breathing/shiver and a slow gust envelope that gates a fast stutter.

import { createNoise1D, smoothstep } from "./noise";

export type Flicker = {
  /** Light output multiplier, ~0.4–1. */
  intensity: number;
  /** Sideways lean of the flame, ~-1–1. */
  sway: number;
  /** Flame height multiplier, ~0.85–1.15. */
  stretch: number;
};

export const STEADY: Flicker = { intensity: 0.94, sway: 0, stretch: 1 };

export function createFlicker(seed = 1) {
  const breathe = createNoise1D(seed);
  const shiver = createNoise1D(seed + 11);
  const crackle = createNoise1D(seed + 23);
  const gust = createNoise1D(seed + 37);
  const lean = createNoise1D(seed + 53);

  return (t: number, amount: number): Flicker => {
    if (amount <= 0) return STEADY;
    const g = smoothstep(0.2, 0.75, gust(t * 0.21));
    const wobble = 0.55 * breathe(t * 1.6) + 0.3 * shiver(t * 4.4) + 0.15 * crackle(t * 10.5);
    const stutter = g * (0.55 + 0.45 * crackle(t * 17));
    const drop = 0.2 * (0.5 - 0.5 * wobble) + 0.4 * Math.max(0, stutter);
    return {
      intensity: Math.max(0.35, 1 - amount * drop),
      sway: amount * (0.65 * lean(t * 0.7) + 0.6 * g * shiver(t * 7.3)),
      stretch: 1 + amount * (0.1 * breathe(t * 2.9 + 5) - 0.12 * g * Math.abs(crackle(t * 13))),
    };
  };
}
