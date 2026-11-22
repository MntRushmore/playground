// Web Audio engine: additive mallet voices → reverb send → compressor → out.
// Raw Web Audio (no Tone.js) keeps the bundle small and gives exact control
// over voice stealing. Must be started from a user gesture.

import { INSTRUMENTS, SOUND } from "./data";
import type { NoteEvent } from "./types";

type Voice = { end: number; gain: GainNode; oscs: OscillatorNode[] };

/** Procedural stereo impulse response: darkening, exponentially decaying noise. */
function makeImpulse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // One-pole lowpass whose cutoff falls over time: bright onset, soft tail.
      const k = 0.55 - 0.45 * t;
      lp += k * (Math.random() * 2 - 1 - lp);
      data[i] = lp * Math.pow(1 - t, 2.2) * Math.exp(-t * 3);
    }
  }
  return buffer;
}

export class MarbleAudio {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private wet: GainNode | null = null;
  private dry: GainNode | null = null;
  private master: GainNode | null = null;
  private voices: Voice[] = [];
  private noise: AudioBuffer | null = null;
  private reverb = 0.4;
  private volume = 0.8;
  private muted = false;

  get started() {
    return this.ctx !== null;
  }

  /** Call inside a pointer/key handler. Safe to call repeatedly. */
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    this.master = ctx.createGain();
    this.bus = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, SOUND.reverbSeconds);
    const preverbHp = ctx.createBiquadFilter();
    preverbHp.type = "highpass";
    preverbHp.frequency.value = 220;

    this.bus.connect(this.dry).connect(comp);
    this.bus.connect(preverbHp).connect(convolver).connect(this.wet).connect(comp);
    comp.connect(this.master).connect(ctx.destination);
    this.applyMix();

    // Shared white-noise burst for mallet transients.
    this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // iOS unlock: play one silent sample inside the gesture.
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silent.connect(ctx.destination);
    silent.start();
    void ctx.resume();
  }

  setReverb(v: number) {
    this.reverb = v;
    this.applyMix();
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyMix();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyMix();
  }

  private applyMix() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.wet || !this.dry) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 1.35, t, 0.03);
    this.wet.gain.setTargetAtTime(this.reverb * 1.1, t, 0.05);
    this.dry.gain.setTargetAtTime(1 - this.reverb * 0.35, t, 0.05);
  }

  suspend() {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  play(note: NoteEvent) {
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.muted || ctx.state !== "running") return;
    const inst = INSTRUMENTS[note.instrument];
    const t0 = ctx.currentTime + SOUND.latency + note.delay;

    this.voices = this.voices.filter((v) => v.end > ctx.currentTime);
    while (this.voices.length >= SOUND.maxVoices) this.steal(this.voices.shift()!, ctx.currentTime);

    const vel = Math.max(0, Math.min(1, note.velocity));
    // Gentle equal-loudness tilt so high notes don't poke out.
    const loudness = Math.pow(440 / note.freq, 0.28);
    const peak = (0.03 + 0.2 * Math.pow(vel, 1.4)) * inst.gain * loudness;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = peak;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = Math.min(16000, note.freq * (3 + vel * 14));
    tone.Q.value = 0.4;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, note.pan));
    voiceGain.connect(tone).connect(pan).connect(this.bus);

    // Physical decay: low bars ring longer than high ones.
    const ring = Math.min(2, Math.max(0.45, Math.pow(330 / note.freq, 0.6)));
    if (inst.click > 0 && this.noise) this.mallet(t0, note.freq, vel, inst.click, voiceGain);

    const oscs: OscillatorNode[] = [];
    let end = t0;
    let longest: OscillatorNode | null = null;
    for (const [ratio, rel, decay] of inst.partials) {
      const f = note.freq * ratio;
      if (f > 15000) continue;
      // Upper partials respond to velocity: harder hits sound brighter.
      const amount = ratio > 1.5 ? rel * (0.35 + 0.65 * vel) : rel;
      const d = decay * ring * (0.75 + 0.25 * vel);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(amount, t0 + inst.attack);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + inst.attack + d);
      osc.connect(env).connect(voiceGain);
      osc.start(t0);
      osc.stop(t0 + inst.attack + d + 0.05);
      oscs.push(osc);
      if (t0 + inst.attack + d + 0.05 > end) {
        end = t0 + inst.attack + d + 0.05;
        longest = osc;
      }
    }
    if (!longest) return;
    longest.onended = () => voiceGain.disconnect();
    this.voices.push({ end, gain: voiceGain, oscs });
  }

  /** A few ms of band-passed noise: the felt/wood contact before the bar rings. */
  private mallet(t0: number, freq: number, vel: number, level: number, out: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(6000, freq * 3 + 600 * vel);
    bp.Q.value = 1.4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(level * (0.2 + 0.8 * vel), t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.018);
    src.connect(bp).connect(env).connect(out);
    src.start(t0);
    src.stop(t0 + 0.03);
  }

  /** Fade a voice out quickly instead of cutting it (no clicks). */
  private steal(v: Voice, now: number) {
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + 0.03);
    for (const o of v.oscs) {
      try {
        o.stop(now + 0.04);
      } catch {
        // already stopped
      }
    }
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.voices = [];
  }
}
