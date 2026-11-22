// Marbles: spawning (droppers or a tap), clearing, and rolling contact. Pure.

import Matter from "matter-js";
import { internals, type BodyTag } from "./bodies";
import { MARBLE_COLORS, SUB_DT } from "./data";
import { DROPPER_MOUTH } from "./geometry";
import { rad, toWorld } from "./transforms";
import type { Sim } from "./physics";
import type { Marble } from "./types";
import type { Orbit } from "./vortex";

const { Bodies, Body, Composite } = Matter;

/**
 * Marbles are polygons in Matter; a polygon rests on a facet on any slope gentler than
 * 360°/sides. 64 sides (5.6°) keeps marbles rolling on gentle tracks (placed tracks snap to
 * 15° steps) while keeping collision tests cheap.
 */
const MARBLE_SIDES = 64;
/** Share of the spin/travel mismatch corrected per sub-step while touching a surface. */
const ROLL_GRIP = 0.35;

export type MarbleRt = Marble & {
  body: Matter.Body;
  still: number;
  cupAt: number;
  px: number;
  py: number;
  pa: number;
  touching: boolean;
  /** Normal of the piece surface it rests on this sub-step (0,0 when airborne). */
  nx: number;
  ny: number;
  /** Velocity of that surface (u per sub-step): moving cleats carry, they don't spin. */
  svx: number;
  svy: number;
  /** Set by bumpers/springs: allowed to gain speed this sub-step. */
  kicked: boolean;
  /** Speed before the sub-step (u per tick), for the anti-explosion guard. */
  pv: number;
  /** Speed another marble hit this one with this sub-step (u per tick). */
  allow: number;
  orbit: Orbit | null;
  /** ms before a funnel may capture this marble again. */
  cool: number;
};

export function spawnMarble(sim: Sim, x: number, y: number, vx = 0, vy = 0) {
  const s = sim.settings;
  const r = s.size;
  const id = sim.nextId++;
  const body = Bodies.polygon(x, y, MARBLE_SIDES, r, {
    restitution: s.bounce,
    friction: s.friction,
    frictionStatic: 0.3,
    frictionAir: 0.0012,
    density: 0.004,
    slop: 0.01,
    label: "marble",
    plugin: { kind: "marble", id } satisfies BodyTag,
  });
  // A solid glass sphere (I = 2/5·m·r²) instead of Matter's stiffened default: marbles pick up
  // speed like real ones, rolling at ~5/7 g·sinθ.
  Body.setInertia(body, body.mass * r * r * 0.4);
  internals(body).deltaTime = SUB_DT;
  Body.setVelocity(body, { x: vx / 60, y: vy / 60 });
  Composite.add(sim.engine.world, body);
  const color = sim.nextColor++ % MARBLE_COLORS.length;
  sim.marbles.push({
    id,
    color,
    radius: r,
    x,
    y,
    angle: 0,
    age: 0,
    dying: -1,
    trail: [],
    body,
    still: 0,
    cupAt: -1,
    px: x,
    py: y,
    pa: 0,
    touching: false,
    nx: 0,
    ny: 0,
    svx: 0,
    svy: 0,
    kicked: false,
    pv: Math.hypot(vx, vy) / 60,
    allow: 0,
    orbit: null,
    cool: 0,
    depth: 0,
  });
}

export function clearMarbles(sim: Sim) {
  for (const m of sim.marbles) Composite.remove(sim.engine.world, m.body);
  sim.marbles.length = 0;
  sim.release = 0.6;
}

export function killMarble(m: MarbleRt) {
  if (m.dying < 0) m.dying = 0;
}

export function aliveCount(sim: Sim) {
  let n = 0;
  for (const m of sim.marbles) if (m.dying < 0) n++;
  return n;
}

export function releaseMarbles(sim: Sim) {
  const s = sim.settings;
  const droppers = [...sim.pieces.values()].filter((rt) => rt.piece.type === "dropper");
  if (!droppers.length) return;
  sim.release = Math.min(1.5, sim.release + (SUB_DT / 1000) * s.release);
  if (sim.release < 1 || aliveCount(sim) >= s.count) return;
  const rt = droppers[sim.nextDropper++ % droppers.length];
  const mouth = toWorld(rt.piece, DROPPER_MOUTH.x, DROPPER_MOUTH.y);
  const clear = sim.marbles.every((m) => Math.hypot(m.body.position.x - mouth.x, m.body.position.y - mouth.y) > s.size * 2.4);
  if (!clear) return;
  const a = rad(rt.piece.angle);
  const jitter = (Math.random() - 0.5) * 4;
  spawnMarble(sim, mouth.x + jitter, mouth.y, -Math.sin(a) * 140, Math.cos(a) * 140);
  sim.release -= 1;
}

/**
 * Rolling without slipping. Matter's friction lets marbles spin out of step with their travel
 * (wheel-spin, sticky backspin). On a surface, pull the spin towards ω = (n × v) / r so marbles
 * roll like glass on plastic, and the visible spin matches the motion.
 */
export function rollingContact(sim: Sim) {
  for (const m of sim.marbles) {
    if (m.orbit || (m.nx === 0 && m.ny === 0)) continue;
    const b = internals(m.body);
    const vx = b.position.x - b.positionPrev.x - m.svx;
    const vy = b.position.y - b.positionPrev.y - m.svy;
    const target = (m.nx * vy - m.ny * vx) / m.radius;
    const omega = b.angle - b.anglePrev;
    const next = omega + (target - omega) * ROLL_GRIP;
    b.anglePrev = b.angle - next;
    b.angularVelocity = next;
  }
}
