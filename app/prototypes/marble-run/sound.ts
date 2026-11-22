// Soft physical sound with plain Web Audio: clacks scaled by impact speed, a quiet rolling
// rumble, a tiny tink when a marble lands in the cup. Rate-limited so busy runs stay calm.
// The AudioContext is created on the first pointer gesture (browser autoplay rules).

import type { Material, SimEvent } from "./types";

export type Sound = {
  unlock: () => void;
  setEnabled: (on: boolean) => void;
  play: (events: readonly SimEvent[]) => void;
  setRolling: (speedSum: number) => void;
  dispose: () => void;
};

const MAX_TOKENS = 6;
const REFILL_PER_S = 22;

export function createSound(): Sound {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let roll: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  let enabled = false;
  let tokens = MAX_TOKENS;
  let lastRefill = 0;

  const init = () => {
    if (ac) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ac = new Ctor();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master = ac.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(comp).connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // Rolling rumble: looping noise through a low-pass, gain follows marble speed.
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    roll = { gain, filter };
  };

  const env = (g: GainNode, t: number, peak: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  };

  const tone = (type: OscillatorType, f0: number, f1: number, peak: number, decay: number) => {
    if (!ac || !master) return;
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.8);
    const g = ac.createGain();
    env(g, t, peak, decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.02);
  };

  const click = (freq: number, q: number, peak: number, decay: number) => {
    if (!ac || !master || !noise) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    env(g, t, peak, decay);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
  };

  const vary = (f: number) => f * (0.92 + Math.random() * 0.16);

  const hit = (material: Material, speed: number) => {
    const k = Math.min(1, speed / 1400);
    const a = Math.pow(k, 1.25);
    switch (material) {
      case "glass":
        tone("sine", vary(3100), vary(3000), 0.09 * a, 0.07);
        tone("sine", vary(5200), vary(5100), 0.035 * a, 0.04);
        break;
      case "bumper":
        tone("triangle", vary(560), 300, 0.1 * Math.max(0.5, a), 0.14);
        break;
      case "spring":
        tone("sine", vary(210), 620, 0.07, 0.12);
        click(900, 3, 0.05, 0.03);
        break;
      case "cup":
        click(vary(1300), 4, 0.12 * a, 0.04);
        break;
      case "wheel":
      case "lift":
      case "switch":
        click(vary(1100), 2.5, 0.16 * a, 0.035);
        tone("sine", vary(620), vary(600), 0.05 * a, 0.03);
        break;
      default:
        // Track: a woody clack.
        click(vary(1750), 2.4, 0.2 * a, 0.035);
        tone("sine", vary(880), vary(860), 0.06 * a, 0.028);
    }
  };

  return {
    unlock() {
      init();
      if (ac?.state === "suspended") void ac.resume();
    },
    setEnabled(on) {
      // Never creates the context here (may run outside a gesture); the next tap unlocks it.
      enabled = on;
      if (ac && master) master.gain.setTargetAtTime(on ? 0.8 : 0, ac.currentTime, 0.05);
    },
    play(events) {
      if (!enabled || !ac || ac.state !== "running" || !events.length) return;
      const now = ac.currentTime;
      tokens = Math.min(MAX_TOKENS, tokens + (now - lastRefill) * REFILL_PER_S);
      lastRefill = now;
      const ranked = [...events].sort((a, b) => weight(b) - weight(a)).slice(0, 3);
      for (const e of ranked) {
        if (tokens < 1) break;
        tokens -= 1;
        if (e.kind === "hit") hit(e.material, e.speed);
        else if (e.kind === "cup") {
          tone("sine", vary(1760), vary(1750), 0.035, 0.45);
          tone("sine", vary(2640), vary(2630), 0.015, 0.3);
        } else click(2600, 1.5, 0.05, 0.02);
      }
    },
    setRolling(speedSum) {
      if (!ac || !roll) return;
      const level = enabled ? Math.min(1, speedSum / 4000) : 0;
      roll.gain.gain.setTargetAtTime(level * 0.05, ac.currentTime, 0.12);
      roll.filter.frequency.setTargetAtTime(220 + level * 700, ac.currentTime, 0.12);
    },
    dispose() {
      void ac?.close();
      ac = null;
    },
  };
}

function weight(e: SimEvent) {
  if (e.kind === "cup") return 2000;
  if (e.kind === "flip") return 300;
  return e.speed;
}
