// The marble machine: owns the layout, editing, visual state and the render loop, on top
// of MarbleWorld (the simulation). Framework-free; the React canvas component just feeds
// it size, settings and pointers.

import { cloneLayout, placeNewBar, randomLayout } from "./arrangement";
import { PHYSICS } from "./data";
import { createBarFx, createEffects, spawnHit, stepBarFx, stepEffects, strikeBar } from "./effects";
import { barGeom, stageOf, unitOf } from "./geometry";
import { Gestures, type GestureHost, type Target } from "./gestures";
import { hitTest } from "./hit-test";
import { MarbleWorld, type Strike } from "./marble-world";
import { degreeToMidi, midiToFreq } from "./music";
import { renderFrame, type Ghost } from "./render-frame";
import { makeBackdrop } from "./render-scene";
import type { Bar, BarFx, BarGeom, Layout, NoteEvent, Settings, Size, ThemeColors } from "./types";

export type MachineCallbacks = {
  onNote: (note: NoteEvent) => void;
  onLayoutChange: (layout: Layout) => void;
};

const WARMUP_SECONDS = 3.2;

export class MarbleMachine implements GestureHost {
  private ctx: CanvasRenderingContext2D;
  private sz: Size = { width: 0, height: 0 };
  private dpr = 1;
  private layout: Layout;
  private geoms = new Map<string, BarGeom>();
  private fx = new Map<string, BarFx>();
  private ghosts: Ghost[] = [];
  private world: MarbleWorld;
  private effects = createEffects();
  private backdrop: HTMLCanvasElement | null = null;
  private emitterAppear = [0, 0, 0];
  private selected: string | null = null;
  private tuning: string | null = null;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private warmed = false;
  private emitting = true;
  private live = false;
  private reduced = false;
  readonly gestures: Gestures;

  constructor(
    private canvas: HTMLCanvasElement,
    private settings: Settings,
    private theme: ThemeColors,
    layout: Layout,
    private cb: MachineCallbacks
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.layout = cloneLayout(layout);
    for (const b of this.layout.bars) this.fx.set(b.id, createBarFx(0, 1));
    this.emitterAppear = this.emitterAppear.map((_, i) => (i < settings.emitters ? 1 : 0));
    this.world = new MarbleWorld((strike) => this.onStrike(strike));
    this.gestures = new Gestures(this);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  resize(width: number, height: number, dpr: number) {
    this.sz = { width, height };
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.world.resize(this.sz);
    this.rebuildGeoms();
    this.backdrop = makeBackdrop(this.sz, stageOf(this.sz), dpr, this.theme);
    // Start mid-performance: simulate a few silent seconds so the machine is already alive.
    if (!this.warmed && !this.reduced) {
      this.warmed = true;
      const steps = Math.round((WARMUP_SECONDS * 1000) / PHYSICS.stepMs);
      for (let i = 0; i < steps; i++) this.world.step(this.settings, this.layout.emitters, this.autoDrop, 0);
      this.effects = createEffects();
    }
    this.render();
  }

  start() {
    if (this.raf || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.world.destroy();
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  // ── Inputs from React ────────────────────────────────────────────────────

  setSettings(s: Settings) {
    this.settings = s;
    this.world.setBounce(s.bounce);
  }

  setTheme(theme: ThemeColors) {
    this.theme = theme;
    if (this.sz.width > 0) this.backdrop = makeBackdrop(this.sz, stageOf(this.sz), this.dpr, theme);
  }

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
  }

  setEmitting(on: boolean) {
    this.emitting = on;
  }

  /** True once sound is on (a user gesture happened). */
  setLive(live: boolean) {
    this.live = live;
  }

  getLayout() {
    return cloneLayout(this.layout);
  }

  setLayout(layout: Layout, animate: boolean) {
    for (const b of this.layout.bars) {
      const geom = this.geoms.get(b.id);
      if (geom && animate) this.ghosts.push({ bar: b, geom, life: 1 });
    }
    this.layout = cloneLayout(layout);
    this.fx.clear();
    this.layout.bars.forEach((b, i) => {
      this.fx.set(b.id, animate && !this.reduced ? createBarFx(0.12 + i * 0.035, 0) : createBarFx(0, 1));
    });
    this.selected = null;
    this.rebuildGeoms();
  }

  newLayout() {
    this.setLayout(randomLayout(this.sz, this.layout.emitters, this.settings.emitters), true);
    this.commit();
  }

  resetLayout(layout: Layout) {
    this.setLayout(layout, true);
    this.commit();
  }

  addBar() {
    const bar = placeNewBar(this.layout, this.sz, this.settings.emitters);
    this.layout.bars.push(bar);
    this.fx.set(bar.id, createBarFx(0, this.reduced ? 1 : 0));
    this.selected = bar.id;
    this.rebuildGeoms();
    this.commit();
  }

  removeSelected() {
    if (this.selected) this.removeBar(this.selected);
  }

  pointer(type: "down" | "move" | "up" | "cancel", e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (type === "down") this.gestures.down(e.pointerId, x, y);
    else if (type === "move") {
      this.gestures.move(e.pointerId, x, y);
      if (!this.gestures.active && e.pointerType === "mouse") this.updateCursor(x, y);
    } else this.gestures.up(e.pointerId, type === "cancel");
  }

  private updateCursor(x: number, y: number) {
    const t = this.hit(x, y);
    this.canvas.style.cursor =
      t.kind === "empty" ? "crosshair" : t.kind === "bar" || t.kind === "emitter" ? "grab" : "pointer";
  }

  // ── GestureHost ──────────────────────────────────────────────────────────

  size() {
    return this.sz;
  }

  bar(id: string) {
    return this.layout.bars.find((b) => b.id === id);
  }

  emitter(index: number) {
    return this.layout.emitters[index];
  }

  hit(x: number, y: number): Target {
    return hitTest(x, y, this.geoms, this.selected, this.layout.emitters.slice(0, this.settings.emitters), this.sz);
  }

  select(id: string | null) {
    this.selected = id;
  }

  setTuning(id: string | null) {
    this.tuning = id;
  }

  dropMarble(x: number, y: number) {
    this.world.drop(x, y, this.settings);
  }

  pluck(id: string, velocity: number) {
    const g = this.geoms.get(id);
    const bar = this.bar(id);
    const fx = this.fx.get(id);
    if (!g || !bar || !fx) return;
    strikeBar(fx, velocity, this.reduced ? 0 : g.thickness); // no flex under reduced motion
    if (!this.reduced) spawnHit(this.effects, g.cx, g.cy, 0, -1, bar.degree, velocity * 0.6, unitOf(this.sz));
    this.emitNote(bar, velocity, g.cx, 0);
  }

  updateBar(id: string, patch: Partial<Omit<Bar, "id">>) {
    const bar = this.bar(id);
    if (!bar) return;
    Object.assign(bar, patch);
    this.geoms.set(id, barGeom(bar, this.sz));
    this.world.setBars(this.geoms);
  }

  moveEmitter(index: number, x: number, y: number) {
    this.layout.emitters[index] = { x, y };
  }

  removeBar(id: string) {
    const bar = this.bar(id);
    const geom = this.geoms.get(id);
    if (!bar) return;
    if (geom && !this.reduced) this.ghosts.push({ bar, geom, life: 1 });
    this.layout.bars = this.layout.bars.filter((b) => b.id !== id);
    this.fx.delete(id);
    if (this.selected === id) this.selected = null;
    this.rebuildGeoms();
    this.commit();
  }

  commit() {
    this.cb.onLayoutChange(this.getLayout());
  }

  // ── Simulation ───────────────────────────────────────────────────────────

  private rebuildGeoms() {
    if (this.sz.width <= 0) return;
    this.geoms.clear();
    for (const b of this.layout.bars) this.geoms.set(b.id, barGeom(b, this.sz));
    this.world.setBars(this.geoms);
  }

  private emitNote(bar: Bar, velocity: number, x: number, delay: number) {
    const s = this.settings;
    this.cb.onNote({
      freq: midiToFreq(degreeToMidi(bar.degree, s)),
      velocity,
      pan: (x / Math.max(1, this.sz.width)) * 1.2 - 0.6,
      delay,
      instrument: s.instrument,
    });
  }

  /** Emitters run once sound is on, and silently before that unless motion is reduced. */
  private get autoDrop() {
    return this.emitting && (this.live || !this.reduced);
  }

  private onStrike(st: Strike) {
    const marble = this.world.marbles.get(st.marbleId);
    const bar = this.bar(st.barId);
    const fx = this.fx.get(st.barId);
    const g = this.geoms.get(st.barId);
    if (!marble || !bar || !fx || !g) return;
    marble.degree = bar.degree;
    marble.flash = 1;
    strikeBar(fx, st.velocity, this.reduced ? 0 : g.thickness);
    if (!this.reduced) spawnHit(this.effects, st.x, st.y, st.nx, st.ny, bar.degree, st.velocity, unitOf(this.sz));
    if (st.audible) this.emitNote(bar, st.velocity, st.x, st.delay);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dtMs = Math.min(100, now - this.last);
    this.last = now;
    this.acc += dtMs;
    let n = 0;
    while (this.acc >= PHYSICS.stepMs && n < PHYSICS.maxSubsteps) {
      this.world.step(this.settings, this.layout.emitters, this.autoDrop, n);
      this.acc -= PHYSICS.stepMs;
      n++;
    }
    if (n === PHYSICS.maxSubsteps) this.acc = 0;
    this.animate(dtMs / 1000);
    this.render();
  };

  private animate(dt: number) {
    for (const fx of this.fx.values()) stepBarFx(fx, dt);
    for (const g of this.ghosts) g.life -= dt / 0.25;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    for (const m of this.world.marbles.values()) m.flash *= Math.exp(-dt / 0.25);
    for (let i = 0; i < 3; i++) {
      this.world.pulses[i] = this.reduced ? 0 : Math.max(0, this.world.pulses[i] - dt / 0.5);
      const target = i < this.settings.emitters ? 1 : 0;
      const step = this.reduced ? 1 : dt / 0.3;
      this.emitterAppear[i] += Math.sign(target - this.emitterAppear[i]) * Math.min(step, Math.abs(target - this.emitterAppear[i]));
    }
    stepEffects(this.effects, dt, this.world.gravityPerFrame());
  }

  private render() {
    renderFrame(this.ctx, {
      size: this.sz,
      dpr: this.dpr,
      theme: this.theme,
      settings: this.settings,
      backdrop: this.backdrop,
      layout: this.layout,
      geoms: this.geoms,
      fx: this.fx,
      ghosts: this.ghosts,
      selected: this.selected,
      tuning: this.tuning,
      rotating: this.gestures.rotating,
      world: this.world,
      effects: this.effects,
      emitterAppear: this.emitterAppear,
      autoDrop: this.autoDrop,
      trails: this.settings.trails && !this.reduced,
    });
  }
}
