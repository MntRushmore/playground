// One synthesized note: additive partials → amp envelope → optional low-pass → pan.
// Plain Web Audio, no React. Works with a live or an OfflineAudioContext.

import { MIN_NOTE } from "./data";
import { loudnessTrim } from "./music";
import { mulberry32 } from "./random";
import type { Envelope, Preset } from "./types";

/** Partials above this are dropped: they only add fizz (and alias on cheap DACs). */
const MAX_PARTIAL_HZ = 9000;
/** setTargetAtTime reaches ~0.1% after this many time constants. */
const TAILS = 7;

export type Voice = {
  readonly start: number;
  /** When the voice will be silent (s, audio clock). */
  readonly end: number;
  /** Let go: fade out over the preset's release. Taps still last MIN_NOTE. */
  release(at: number): void;
  /** Fast fade for voice stealing. */
  kill(at: number): void;
};

/** Half a second of white noise per context, shared by every strike. */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const rand = mulberry32(3);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** Value of the amp envelope `t` seconds after the note started (before release). */
export function envelopeAt(env: Envelope, peak: number, t: number) {
  if (t <= 0) return 0;
  if (t < env.attack) return (peak * t) / env.attack;
  const floor = env.sustain * peak;
  return floor + (peak - floor) * Math.exp(-(t - env.attack) / env.decay);
}

export function createVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  preset: Preset,
  freq: number,
  options: { velocity: number; pan: number; when: number; onEnded?: () => void }
): Voice {
  const { env } = preset;
  const when = options.when;
  const peak = options.velocity * preset.gain * loudnessTrim(freq);

  // Amp envelope.
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(peak, when + env.attack);
  amp.gain.setTargetAtTime(env.sustain * peak, when + env.attack, env.decay / 3);
  // decay is the time to fall most of the way; a third of it as the time constant reads naturally.

  // Chain: amp → [filter] → [pan] → destination.
  let tail: AudioNode = amp;
  const nodes: AudioNode[] = [amp];
  if (preset.filter) {
    const f = preset.filter;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = f.q ?? 0.5;
    const base = Math.min(f.max, freq * f.mul);
    if (f.peakMul && f.decay) {
      lp.frequency.setValueAtTime(Math.min(f.max * 2, freq * f.peakMul), when);
      lp.frequency.setTargetAtTime(base, when, f.decay);
    } else {
      lp.frequency.value = base;
    }
    tail.connect(lp);
    tail = lp;
    nodes.push(lp);
  }
  if (typeof ctx.createStereoPanner === "function" && options.pan !== 0) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = options.pan;
    tail.connect(pan);
    tail = pan;
    nodes.push(pan);
  }
  tail.connect(destination);

  // Optional vibrato LFO, shared by every partial through `detune`.
  let vibrato: GainNode | null = null;
  const oscillators: AudioScheduledSourceNode[] = [];
  if (preset.vibrato) {
    const v = preset.vibrato;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.rate;
    vibrato = ctx.createGain();
    vibrato.gain.setValueAtTime(0, when);
    vibrato.gain.setValueAtTime(0, when + v.delay);
    vibrato.gain.linearRampToValueAtTime(v.cents, when + v.delay + 0.5);
    lfo.connect(vibrato);
    oscillators.push(lfo);
    nodes.push(lfo, vibrato);
  }

  for (const p of preset.partials) {
    const hz = freq * p.ratio;
    if (hz > MAX_PARTIAL_HZ) continue;
    const osc = ctx.createOscillator();
    osc.type = p.wave ?? "sine";
    osc.detune.value = p.detune ?? 0;
    if (preset.glide) {
      osc.frequency.setValueAtTime(hz * preset.glide.from, when);
      osc.frequency.exponentialRampToValueAtTime(hz, when + preset.glide.time);
    } else {
      osc.frequency.value = hz;
    }
    vibrato?.connect(osc.detune);
    const g = ctx.createGain();
    g.gain.setValueAtTime(p.gain, when);
    if (p.decay) g.gain.setTargetAtTime(0, when + env.attack, p.decay / 3);
    osc.connect(g);
    g.connect(amp);
    oscillators.push(osc);
    nodes.push(osc, g);
  }

  // Breath: looped noise tuned to the note, riding the amp envelope (flute-like air).
  if (preset.breath) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(8000, freq * 2);
    bp.Q.value = preset.breath.q;
    const g = ctx.createGain();
    g.gain.value = preset.breath.gain;
    src.connect(bp).connect(g).connect(amp);
    oscillators.unshift(src);
    nodes.push(src, bp, g);
  }

  // Hammer / mallet thump: a few ms of band-passed noise. It stops early, so it isn't
  // in `oscillators` (whose last member signals the end of the voice).
  if (preset.strike) {
    const s = preset.strike;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(8000, freq * s.mul);
    bp.Q.value = s.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(s.gain, when);
    g.gain.setTargetAtTime(0, when, s.decay / 3);
    src.connect(bp).connect(g).connect(amp);
    src.start(when);
    src.stop(when + s.decay * 2 + 0.02);
    nodes.push(src, bp, g);
  }

  // Decaying presets (sustain 0) end by themselves.
  let end = env.sustain === 0 ? when + env.attack + (env.decay / 3) * TAILS : Infinity;
  const stopAll = (at: number) => {
    for (const o of oscillators) {
      try {
        o.stop(at);
      } catch {
        // already stopped
      }
    }
  };
  for (const o of oscillators) o.start(when);
  if (Number.isFinite(end)) stopAll(end);

  const last = oscillators[oscillators.length - 1];
  if (last) {
    last.onended = () => {
      for (const n of nodes) n.disconnect();
      options.onEnded?.();
    };
  }

  return {
    start: when,
    get end() {
      return end;
    },
    release(at) {
      // Never cut into the attack (keeps the automation simple and taps audible).
      const t = Math.max(at, when + MIN_NOTE, when + env.attack);
      if (t >= end) return;
      const v = envelopeAt({ ...env, decay: env.decay / 3 }, peak, t - when);
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(v, t);
      amp.gain.setTargetAtTime(0, t, env.release / 5);
      const stopAt = t + env.release + 0.05;
      if (stopAt < end) {
        end = stopAt;
        stopAll(stopAt);
      }
    },
    kill(at) {
      const t = Math.max(at, when + env.attack);
      const v = envelopeAt({ ...env, decay: env.decay / 3 }, peak, t - when);
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(v, t);
      amp.gain.linearRampToValueAtTime(0, t + 0.04);
      end = Math.min(end, t + 0.05);
      stopAll(t + 0.05);
    },
  };
}
