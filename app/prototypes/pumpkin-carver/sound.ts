// Small Web Audio sound kit, all synthesized from one noise buffer: the knife's scrape
// (follows stroke speed), a soft thunk for presets, a match strike when the candle is
// lit, a puff when it's blown out, and a faint crackle while it burns. Off by default;
// the AudioContext is only created from a user gesture.

import type { Tool } from "./types";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let enabled = false;
let carve: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
let crackleTimer: ReturnType<typeof setInterval> | undefined;
let crackleWanted = false;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** A filtered noise burst with an attack/decay envelope. */
function burst(type: BiquadFilterType, freq: number, peak: number, attack: number, decay: number, at = 0) {
  const c = ensure();
  if (!c || !master || !noise) return;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 1.5);
  src.stop(t + attack + decay + 0.05);
}

function tone(freq: number, peak: number, decay: number) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + decay);
  const gain = c.createGain();
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

function crackle() {
  if (!enabled || !crackleWanted || document.hidden || ctx?.state !== "running") return;
  if (Math.random() < 0.5) burst("highpass", 1800 + Math.random() * 2500, 0.04 + Math.random() * 0.12, 0.002, 0.015 + Math.random() * 0.03, Math.random() * 0.06);
}

function syncCrackle() {
  const on = enabled && crackleWanted;
  if (on && !crackleTimer) crackleTimer = setInterval(crackle, 70);
  if (!on && crackleTimer) {
    clearInterval(crackleTimer);
    crackleTimer = undefined;
  }
}

const CARVE_FREQ: Record<Tool, number> = { carve: 1900, etch: 3400, patch: 650 };

export const sound = {
  /**
   * `fromGesture`: called from a click, so the AudioContext may start now. On page load
   * we only remember the preference; the context starts on the first gesture.
   */
  setEnabled(on: boolean, fromGesture = true) {
    enabled = on;
    if (on && fromGesture) ensure();
    else sound.carveEnd();
    syncCrackle();
  },
  /** Candle burning: faint random crackles. */
  setCrackle(on: boolean) {
    crackleWanted = on;
    syncCrackle();
  },
  carveStart(tool: Tool) {
    if (!enabled) return;
    const c = ensure();
    if (!c || !master || !noise || carve) return;
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = CARVE_FREQ[tool];
    filter.Q.value = 1.4;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    carve = { src, filter, gain };
  },
  /** `speed` 0–1: louder and brighter the faster the knife moves. */
  carveMove(speed: number, tool: Tool) {
    if (!carve || !ctx) return;
    const t = ctx.currentTime;
    const s = Math.min(1, speed);
    carve.gain.gain.setTargetAtTime(0.05 + s * 0.4, t, 0.03);
    carve.filter.frequency.setTargetAtTime(CARVE_FREQ[tool] * (0.8 + s * 0.5 + Math.random() * 0.1), t, 0.05);
  },
  carveEnd() {
    if (!carve || !ctx) return;
    const { src, gain } = carve;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    src.stop(ctx.currentTime + 0.2);
    carve = null;
  },
  thunk() {
    if (!enabled) return;
    tone(110, 0.35, 0.22);
    burst("lowpass", 700, 0.3, 0.004, 0.12);
  },
  ignite() {
    if (!enabled) return;
    burst("highpass", 2600, 0.35, 0.005, 0.12);
    burst("lowpass", 500, 0.4, 0.12, 0.45, 0.06);
  },
  snuff() {
    if (!enabled) return;
    burst("lowpass", 900, 0.3, 0.03, 0.3);
  },
};
