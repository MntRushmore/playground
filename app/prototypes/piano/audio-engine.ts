// Owns the AudioContext, the master bus (reverb, compressor, limiter) and the voices.
// No React. The context is created on the first gesture, never on page load.

import { MAX_VOICES } from "./data";
import { PRESETS } from "./sound-presets";
import { midiToFreq } from "./music";
import { createImpulse } from "./reverb";
import { createVoice, type Voice } from "./synth";
import type { PresetId } from "./types";

export type MasterBus = {
  input: AudioNode;
  setVolume: (v: number, at: number) => void;
  setReverb: (v: number, at: number) => void;
};

/**
 * voices → high-pass → soft high shelf ─┬─ dry ──────────┐
 *                                       └─ convolver ─ wet ┴→ compressor → volume → limiter → out
 */
export function createMasterBus(ctx: BaseAudioContext, out: AudioNode): MasterBus {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 40;
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 5000;
  shelf.gain.value = -5;

  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulse(ctx);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 18;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.25;

  const volume = ctx.createGain();
  // Brick-wall-ish limiter: mashing ten keys never clips.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;

  input.connect(hp).connect(shelf);
  shelf.connect(dry).connect(comp);
  shelf.connect(convolver).connect(wet).connect(comp);
  comp.connect(volume).connect(limiter).connect(out);

  return {
    input,
    // Squared: the slider feels even, and low settings get properly quiet.
    setVolume: (v, at) => volume.gain.setTargetAtTime(v * v * 1.1, at, 0.05),
    setReverb: (v, at) => {
      wet.gain.setTargetAtTime(v * 0.9, at, 0.05);
      dry.gain.setTargetAtTime(1 - v * 0.3, at, 0.05);
    },
  };
}

type Settings = { preset: PresetId; volume: number; reverb: number };

export class PianoAudio {
  private ctx: AudioContext | null = null;
  private bus: MasterBus | null = null;
  /** Held notes by press id (a finger, or a computer key). */
  private held = new Map<string, Voice>();
  /** Everything still sounding, oldest first, for voice stealing. */
  private sounding: Voice[] = [];
  private settings: Settings = { preset: "piano", volume: 0.8, reverb: 0.35 };
  private onState: ((state: string) => void) | null = null;

  /** Create/resume the context. Call from every pointer/key gesture until it runs. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx({ latencyHint: "interactive" });
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.bus = createMasterBus(ctx, ctx.destination);
      this.applySettings();
      ctx.onstatechange = () => this.onState?.(ctx.state);
      this.onState?.(ctx.state);
    }
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
  }

  /** Follow the AudioContext state ("suspended", "running", …). Returns an unsubscribe. */
  listen(fn: (state: string) => void) {
    this.onState = fn;
    if (this.ctx) fn(this.ctx.state);
    return () => {
      if (this.onState === fn) this.onState = null;
    };
  }

  configure(next: Settings) {
    this.settings = next;
    this.applySettings();
  }

  private applySettings() {
    if (!this.ctx || !this.bus) return;
    const now = this.ctx.currentTime;
    this.bus.setVolume(this.settings.volume, now);
    this.bus.setReverb(this.settings.reverb, now);
  }

  noteOn(id: string, midi: number, pan = 0) {
    this.unlock();
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    this.noteOff(id);

    const now = ctx.currentTime;
    this.sounding = this.sounding.filter((v) => v.end > now);
    while (this.sounding.length >= MAX_VOICES) this.sounding.shift()?.kill(now);

    const preset = PRESETS[this.settings.preset];
    const voice = createVoice(ctx, bus.input, preset, midiToFreq(midi + preset.transpose), {
      velocity: 0.9 + Math.random() * 0.1,
      pan,
      when: now,
      onEnded: () => {
        this.sounding = this.sounding.filter((v) => v !== voice);
      },
    });
    this.held.set(id, voice);
    this.sounding.push(voice);
  }

  noteOff(id: string) {
    const voice = this.held.get(id);
    if (!voice || !this.ctx) return;
    this.held.delete(id);
    voice.release(this.ctx.currentTime);
  }

  allOff() {
    for (const id of [...this.held.keys()]) this.noteOff(id);
  }

  dispose() {
    this.allOff();
    this.sounding = [];
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.bus = null;
  }
}
