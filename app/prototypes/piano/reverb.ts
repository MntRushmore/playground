// A soft, computed room for the reverb (no recorded impulse response). Pure Web Audio.

import { mulberry32 } from "./random";

/**
 * Stereo noise tail that decays exponentially and gets darker as it fades,
 * like a small carpeted room. `seconds` ≈ time to fall ~60 dB.
 */
export function createImpulse(ctx: BaseAudioContext, seconds = 2.4, seed = 7) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const rand = mulberry32(seed + ch * 101);
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // One-pole low-pass whose cutoff falls over the tail: bright start, warm end.
      const k = 0.55 * (1 - t) ** 2 + 0.04;
      lp += k * (rand() * 2 - 1 - lp);
      // Short fade-in avoids a hard "click" of early energy.
      const fadeIn = Math.min(1, i / (rate * 0.008));
      data[i] = lp * Math.exp(-6.9 * t) * fadeIn;
    }
  }
  // Normalize so the wet level is predictable.
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    for (const v of buffer.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
  }
  if (peak > 0) {
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = (data[i] / peak) * 0.5;
    }
  }
  return buffer;
}
