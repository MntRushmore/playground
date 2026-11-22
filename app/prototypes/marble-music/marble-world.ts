// The simulated world: marbles, emitter clocks and debounced bar strikes on top of
// the Matter.js physics. No DOM, no drawing.

import { PHYSICS, SOUND } from "./data";
import { barThickness, marbleRadius, toPxX, unitOf } from "./geometry";
import { impactVelocity } from "./music";
import {
  addMarble,
  createPhysics,
  destroyPhysics,
  removeMarble,
  rescaleMarbles,
  setBounds,
  setGravity,
  setRestitution,
  speedOf,
  stepPhysics,
  syncBars,
  type Physics,
} from "./physics";
import type { BarGeom, Contact, Emitter, MarbleState, Settings, Size } from "./types";

/** A marble hit a bar hard enough to ring it. */
export type Strike = Contact & {
  velocity: number;
  /** Seconds into the current frame, so audio keeps substep timing. */
  delay: number;
  /** False when the same bar rang a moment ago (still glows, doesn't retrigger). */
  audible: boolean;
};

export class MarbleWorld {
  readonly physics: Physics;
  readonly marbles = new Map<number, MarbleState>();
  /** Seconds until each emitter's next drop. */
  readonly clocks = [...PHYSICS.firstDrops];
  /** 1 → 0 after a drop, for the emitter's pulse ring. */
  readonly pulses = [0, 0, 0];
  private barRang = new Map<string, number>();
  private size: Size = { width: 0, height: 0 };
  private time = 0;
  private substep = 0;

  constructor(private onStrike: (s: Strike) => void) {
    this.physics = createPhysics((c) => this.contact(c));
  }

  resize(size: Size) {
    const prev = this.size;
    if (prev.width > 0) rescaleMarbles(this.physics, size.width / prev.width, size.height / prev.height);
    this.size = size;
    setBounds(this.physics, size);
  }

  setBars(geoms: Map<string, BarGeom>) {
    syncBars(this.physics, geoms);
  }

  setBounce(r: number) {
    setRestitution(this.physics, r);
  }

  /** Emitter drop period in seconds: 2:3:4 between emitters. */
  period(i: number, s: Settings) {
    return (60 / s.dropRate) * PHYSICS.emitterRatios[i];
  }

  drop(x: number, y: number, s: Settings) {
    const live = [...this.marbles.values()].filter((m) => !m.fading);
    if (live.length >= PHYSICS.maxMarbles) live[0].fading = true;
    const radius = marbleRadius(this.size, s.marbleSize);
    const body = addMarble(this.physics, x, y, radius);
    this.marbles.set(body.id, {
      id: body.id,
      radius,
      degree: null,
      flash: 0,
      age: 0,
      still: 0,
      fade: 1,
      fading: false,
      trail: [],
      hits: new Map(),
    });
  }

  /** One fixed physics step. `substep` is this step's index within the frame. */
  step(s: Settings, emitters: Emitter[], auto: boolean, substep: number) {
    const h = PHYSICS.stepMs / 1000;
    this.time += h;
    this.substep = substep;

    for (let i = 0; i < s.emitters; i++) {
      if (!auto) continue;
      const period = this.period(i, s);
      this.clocks[i] = Math.min(this.clocks[i] - h, period);
      if (this.clocks[i] > 0) continue;
      this.clocks[i] = Math.max(0.05, this.clocks[i] + period);
      const em = emitters[i];
      const jitter = (Math.random() - 0.5) * 2 * s.wander * unitOf(this.size) * 0.035;
      this.drop(toPxX(em.x, this.size) + jitter, em.y * this.size.height, s);
      this.pulses[i] = 1;
    }

    setGravity(this.physics, s.gravity, this.size);
    stepPhysics(this.physics, (barThickness(this.size) + marbleRadius(this.size, s.marbleSize)) * 0.9);

    for (const m of this.marbles.values()) {
      const body = this.physics.marbles.get(m.id);
      if (!body) continue;
      m.age += h;
      m.trail.push({ x: body.position.x, y: body.position.y });
      if (m.trail.length > 14) m.trail.shift();
      m.still = speedOf(body) < PHYSICS.stillSpeed ? m.still + h : 0;
      if (m.still > PHYSICS.stillSeconds || m.age > PHYSICS.maxAgeSeconds) m.fading = true;
      if (m.fading) m.fade -= h / PHYSICS.fadeSeconds;
      if (body.position.y > this.size.height + m.radius * 4 || m.fade <= 0) {
        removeMarble(this.physics, m.id);
        this.marbles.delete(m.id);
      }
    }
  }

  position(id: number) {
    return this.physics.marbles.get(id)?.position;
  }

  /** Gravity in px per (1/60 s)², for effects that should fall like marbles. */
  gravityPerFrame() {
    return this.physics.engine.gravity.scale * (1000 / 60) ** 2;
  }

  private contact(c: Contact) {
    const marble = this.marbles.get(c.marbleId);
    if (!marble) return;
    const now = this.time;
    // A marble rattling on one bar would buzz: debounce per marble/bar pair.
    if (now - (marble.hits.get(c.barId) ?? -1) < SOUND.pairCooldown) return;
    marble.hits.set(c.barId, now);

    const k = Math.min(1.5, Math.max(0.55, this.size.height / PHYSICS.refHeight));
    const g = this.physics.engine.gravity.scale * 1e6; // px/s²
    const ref = Math.sqrt(2 * g * this.size.height * 0.4); // speed after falling 40% of the height
    const velocity = impactVelocity(c.speed, SOUND.minImpact * k, ref);
    if (velocity <= 0) return;

    const audible = now - (this.barRang.get(c.barId) ?? -1) >= SOUND.barCooldown;
    if (audible) this.barRang.set(c.barId, now);
    this.onStrike({ ...c, velocity, delay: (this.substep * PHYSICS.stepMs) / 1000, audible });
  }

  destroy() {
    destroyPhysics(this.physics);
  }
}
