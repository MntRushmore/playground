// The simulation: Matter engine, piece bodies, fixed sub-stepping, marble lifetimes.
// Pure: no DOM or React, so it also runs headless (see HOW_IT_WORKS.md).

import Matter from "matter-js";
import { buildPieceBodies, stepVelocity } from "./bodies";
import { attachCollisions } from "./collisions";
import { FADE_MS, GRAVITY, MAX_SPEED, MAX_SUBSTEPS, SUB_DT, WORLD } from "./data";
import { driveKinematics } from "./kinematics";
import { aliveCount, killMarble, releaseMarbles, rollingContact, type MarbleRt } from "./marbles";
import { driveVortices } from "./vortex";
import type { Piece, Settings, SimEvent, Spark } from "./types";

export { clearMarbles, spawnMarble, type MarbleRt } from "./marbles";

const { Engine, Composite, Body } = Matter;

/** Velocity (world units per 1/60 s) from the last sub-step's displacement. */
export const TICK = 1000 / 60 / SUB_DT;
const STILL_MS = 3200;
const CUP_HOLD_MS = 3500;
const TRAIL_EVERY_MS = 1000 / 60;
const TRAIL_LEN = 9;
const GUARD_MARGIN = 300 / 60;

export type PieceRt = {
  piece: Piece;
  key: string;
  body: Matter.Body | null;
  sensor: Matter.Body | null;
  cleats: Matter.Body[];
  cleatOn: boolean[];
  /** Wheel spin or switch tilt (rad). */
  turn: number;
  /** Switch: current side (-1 left, 1 right), animation start, armed by a marble. */
  side: number;
  flipT: number;
  armed: boolean;
  clearFor: number;
  belt: number;
  flash: number;
};

export type Sim = {
  engine: Matter.Engine;
  pieces: Map<string, PieceRt>;
  marbles: MarbleRt[];
  sparks: Spark[];
  events: SimEvent[];
  settings: Settings;
  time: number;
  acc: number;
  release: number;
  nextDropper: number;
  nextId: number;
  nextColor: number;
  trailClock: number;
  /** Sum of rolling marble speeds (u/s), for the rolling sound. */
  rolling: number;
};

export function createSim(settings: Settings): Sim {
  const engine = Engine.create({ enableSleeping: false, positionIterations: 8, velocityIterations: 6 });
  engine.gravity.y = 1;
  const sim: Sim = {
    engine,
    pieces: new Map(),
    marbles: [],
    sparks: [],
    events: [],
    settings,
    time: 0,
    acc: 0,
    release: 0.6,
    nextDropper: 0,
    nextId: 1,
    nextColor: 0,
    trailClock: 0,
    rolling: 0,
  };
  attachCollisions(sim);
  return sim;
}

function pieceKey(p: Piece) {
  return `${p.type}|${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.angle}|${p.flip}`;
}

function removeRt(sim: Sim, rt: PieceRt) {
  const world = sim.engine.world;
  if (rt.body) Composite.remove(world, rt.body);
  if (rt.sensor) Composite.remove(world, rt.sensor);
  for (const c of rt.cleats) Composite.remove(world, c);
}

/** Diffs pieces against the world: adds, removes and rebuilds only what changed. */
export function syncPieces(sim: Sim, pieces: readonly Piece[]) {
  const world = sim.engine.world;
  const seen = new Set<string>();
  for (const p of pieces) {
    seen.add(p.id);
    const key = pieceKey(p);
    let rt = sim.pieces.get(p.id);
    if (rt && rt.key === key) {
      rt.piece = p;
      continue;
    }
    if (rt) removeRt(sim, rt);
    const built = buildPieceBodies(p);
    const flipped = rt ? rt.piece.flip !== p.flip || rt.piece.type !== p.type : true;
    rt = {
      piece: p,
      key,
      ...built,
      cleatOn: built.cleats.map(() => false),
      turn: rt && !flipped ? rt.turn : 0,
      side: rt && !flipped ? rt.side : p.flip ? 1 : -1,
      flipT: 1,
      armed: false,
      clearFor: 0,
      belt: rt?.belt ?? 0,
      flash: 0,
    };
    if (rt.body) Composite.add(world, rt.body);
    if (rt.sensor) Composite.add(world, rt.sensor);
    for (const c of rt.cleats) Composite.add(world, c);
    sim.pieces.set(p.id, rt);
  }
  for (const [id, rt] of sim.pieces) {
    if (!seen.has(id)) {
      removeRt(sim, rt);
      sim.pieces.delete(id);
    }
  }
}



function applySettings(sim: Sim) {
  const s = sim.settings;
  sim.engine.gravity.scale = (GRAVITY * s.gravity) / 1e6;
  for (const m of sim.marbles) {
    m.body.restitution = s.bounce;
    m.body.friction = s.friction;
  }
  let extra = aliveCount(sim) - s.count;
  for (const m of sim.marbles) {
    if (extra <= 0) break;
    if (m.dying < 0) {
      killMarble(m);
      extra--;
    }
  }
}

function substep(sim: Sim) {
  releaseMarbles(sim);
  driveKinematics(sim, SUB_DT);
  for (const m of sim.marbles) {
    m.px = m.body.position.x;
    m.py = m.body.position.y;
    m.pa = m.body.angle;
    m.touching = false;
    m.nx = 0;
    m.ny = 0;
    m.kicked = false;
    const v = stepVelocity(m.body, TICK);
    m.pv = Math.hypot(v.x, v.y);
    m.allow = 0;
  }
  Engine.update(sim.engine, SUB_DT);
  rollingContact(sim);
  driveVortices(sim, SUB_DT);
  sim.time += SUB_DT;

  const maxTick = MAX_SPEED / 60;
  const world = sim.engine.world;
  for (let i = sim.marbles.length - 1; i >= 0; i--) {
    const m = sim.marbles[i];
    const b = m.body;
    const { x: vx, y: vy } = stepVelocity(b, TICK);
    const speed = Math.hypot(vx, vy);
    // Guard against solver explosions (a marble pinched between moving parts): only bumpers and
    // springs add real energy; otherwise a marble can't beat its own (or a hitting marble's)
    // previous speed by more than gravity plus motor speed.
    const limit = m.kicked ? maxTick : Math.min(maxTick, Math.max(m.pv, m.allow) + GUARD_MARGIN);
    if (speed > limit) Body.setVelocity(b, { x: (vx / speed) * limit, y: (vy / speed) * limit });
    m.age += SUB_DT;

    if (m.dying >= 0) {
      m.dying += SUB_DT;
      if (m.dying > FADE_MS) {
        Composite.remove(world, b);
        sim.marbles.splice(i, 1);
      }
      continue;
    }
    m.still = speed < 0.5 ? m.still + SUB_DT : 0;
    const { x, y } = b.position;
    const out = y > WORLD.height + 40 || y < -500 || x < -60 || x > WORLD.width + 60;
    if (out || m.still > STILL_MS || (m.cupAt >= 0 && sim.time - m.cupAt > CUP_HOLD_MS)) killMarble(m);
  }
}

function updateFrameEffects(sim: Sim, simMs: number) {
  sim.trailClock += simMs;
  const pushTrail = sim.trailClock >= TRAIL_EVERY_MS;
  if (pushTrail) sim.trailClock %= TRAIL_EVERY_MS;
  let rolling = 0;
  for (const m of sim.marbles) {
    if (pushTrail) {
      m.trail.push({ x: m.body.position.x, y: m.body.position.y });
      if (m.trail.length > TRAIL_LEN) m.trail.shift();
    }
    if (m.touching && m.dying < 0) rolling += m.body.speed * TICK * 60;
  }
  sim.rolling = rolling;
  const dt = simMs / 1000;
  for (let i = sim.sparks.length - 1; i >= 0; i--) {
    const sp = sim.sparks[i];
    sp.life -= dt / 0.8;
    sp.vy += 500 * dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    if (sp.life <= 0) sim.sparks.splice(i, 1);
  }
  const decay = Math.exp(-simMs / 260);
  for (const rt of sim.pieces.values()) rt.flash *= decay;
}

/** Interpolates render positions between the last two sub-steps (smooth at any time scale). */
function interpolate(sim: Sim) {
  const t = Math.min(1, sim.acc / SUB_DT);
  for (const m of sim.marbles) {
    const b = m.body;
    m.x = m.px + (b.position.x - m.px) * t;
    m.y = m.py + (b.position.y - m.py) * t;
    m.angle = m.pa + (b.angle - m.pa) * t;
  }
}

/** Advances the sim by one rendered frame. `frameMs` is wall time; time scale is applied here. */
export function stepSim(sim: Sim, frameMs: number, settings: Settings, running: boolean) {
  sim.settings = settings;
  applySettings(sim);
  if (!running) {
    sim.acc = 0;
    for (const m of sim.marbles) {
      m.px = m.x = m.body.position.x;
      m.py = m.y = m.body.position.y;
      m.pa = m.angle = m.body.angle;
    }
    return;
  }
  const simMs = Math.min(frameMs, 50) * settings.timeScale;
  sim.acc += simMs;
  let n = 0;
  while (sim.acc >= SUB_DT && n < MAX_SUBSTEPS) {
    substep(sim);
    sim.acc -= SUB_DT;
    n++;
  }
  if (n >= MAX_SUBSTEPS) sim.acc = 0;
  updateFrameEffects(sim, simMs);
  interpolate(sim);
}

/** Runs the sim forward instantly (used on load so the default run is already busy). */
export function warmUp(sim: Sim, ms: number) {
  const frames = Math.round(ms / (1000 / 60));
  // Release faster than usual so the whole run is populated on first paint.
  const s = { ...sim.settings, timeScale: 1, release: sim.settings.release * 2.5 };
  for (let i = 0; i < frames; i++) stepSim(sim, 1000 / 60, s, true);
  sim.events.length = 0;
  for (const rt of sim.pieces.values()) rt.flash = 0;
  sim.sparks.length = 0;
}

export function drainEvents(sim: Sim) {
  const out = sim.events;
  sim.events = [];
  return out;
}
