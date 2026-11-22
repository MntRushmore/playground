// Vortex funnel. A 2D side view can't roll a marble around a cone, so upright funnels take
// over: a marble that drops in orbits the cone, conserving angular momentum (ω·r² stays
// constant), so it whirls faster and faster as the radius shrinks, passes behind and in front
// of the cone, then drops out of the neck. Collisions are off while it orbits. Pure.

import Matter from "matter-js";
import { Kinematic, internals } from "./bodies";
import { SUB_DT } from "./data";
import { FUNNEL, funnelY } from "./geometry";
import { rad, toLocal, toWorld } from "./transforms";
import type { MarbleRt } from "./marbles";
import type { PieceRt, Sim } from "./physics";

const { Body } = Matter;

export type Orbit = {
  funnel: string;
  r: number;
  theta: number;
  dir: number;
  /** Angular momentum per unit mass (rad/s · u²). */
  momentum: number;
  /** Radius shrink rate, u/s. */
  rate: number;
  /** Offset from the orbit path at capture, faded out so capture never jumps. */
  ox: number;
  oy: number;
  blend: number;
};

const MAX_UPRIGHT = 31;
const MAX_ORBITING = 8;
const MAX_OMEGA = 24;
const COOLDOWN_MS = 600;
const SETTLE = 30;
const BLEND_MS = 160;

function halfWidthAt(y: number) {
  const { rim, rimY, neck, neckY } = FUNNEL;
  return rim - ((y - rimY) / (neckY - rimY)) * (rim - neck);
}

function tryCapture(sim: Sim, m: MarbleRt, funnels: PieceRt[]) {
  for (const rt of funnels) {
    const p = rt.piece;
    const l = toLocal(p, m.body.position.x, m.body.position.y);
    if (l.y < FUNNEL.rimY - 6 || l.y > funnelY(FUNNEL.neck + m.radius + 18)) continue;
    if (Math.abs(l.x) > halfWidthAt(l.y) - m.radius * 0.3) continue;
    let count = 0;
    for (const o of sim.marbles) if (o.orbit?.funnel === p.id) count++;
    if (count >= MAX_ORBITING) return;

    const prev = internals(m.body).positionPrev;
    const a = -rad(p.angle);
    const wvx = (m.body.position.x - prev.x) * (1000 / SUB_DT);
    const wvy = (m.body.position.y - prev.y) * (1000 / SUB_DT);
    const vx = (wvx * Math.cos(a) - wvy * Math.sin(a)) * (p.flip ? -1 : 1);
    const r0 = Math.min(FUNNEL.rim - 6, Math.max(Math.abs(l.x) + 24, 56));
    const theta = Math.acos(Math.max(-1, Math.min(1, l.x / r0)));
    const dir = vx < 0 ? 1 : -1;
    const omega = Math.min(7, Math.max(2.6, Math.abs(vx) / r0 + 1.4));
    const time = (0.9 + 1.6 * (r0 / FUNNEL.rim)) / Math.sqrt(sim.settings.gravity);
    m.orbit = { funnel: p.id, r: r0, theta, dir, momentum: omega * r0 * r0, rate: (r0 - FUNNEL.neck) / time, ox: 0, oy: 0, blend: 1 };
    const start = orbitPoint(m, p);
    m.orbit.ox = m.body.position.x - start.x;
    m.orbit.oy = m.body.position.y - start.y;
    m.body.collisionFilter.mask = 0;
    return;
  }
}

function release(m: MarbleRt, rt: PieceRt) {
  const p = rt.piece;
  const a = rad(p.angle);
  const speed = 200 / 60;
  Body.setVelocity(m.body, { x: -Math.sin(a) * speed, y: Math.cos(a) * speed });
  m.body.collisionFilter.mask = 0xffffffff;
  m.orbit = null;
  m.depth = 0;
  m.cool = COOLDOWN_MS;
  m.kicked = true;
}

function orbitPoint(m: MarbleRt, p: PieceRt["piece"]) {
  const o = m.orbit!;
  // Ease towards the centre line over the last stretch so the marble lines up with the neck.
  const k = Math.min(1, (o.r - FUNNEL.neck) / SETTLE);
  const x = o.r * Math.cos(o.theta) * k;
  const depth = Math.sin(o.theta) * k;
  const y = funnelY(o.r) - m.radius * 0.75 - FUNNEL.tilt * o.r * depth;
  const w = toWorld(p, x, y);
  return { x: w.x + o.ox * o.blend, y: w.y + o.oy * o.blend, depth };
}

function advance(m: MarbleRt, rt: PieceRt, dt: number) {
  const o = m.orbit!;
  const s = dt / 1000;
  o.r = Math.max(FUNNEL.neck, o.r - o.rate * s);
  const omega = Math.min(MAX_OMEGA, o.momentum / (o.r * o.r));
  o.theta += o.dir * omega * s;
  o.blend = Math.max(0, o.blend - dt / BLEND_MS);
  const { depth, ...w } = orbitPoint(m, rt.piece);
  Kinematic.setPosition(m.body, w, true);
  // Spin as if rolling around the cone wall.
  Kinematic.setAngle(m.body, m.body.angle - o.dir * omega * (o.r / m.radius) * s, true);
  m.depth = depth;
  m.kicked = true;
  if (o.r <= FUNNEL.neck + 0.5) release(m, rt);
}

/** Runs after each physics sub-step: captures marbles that drop into funnels and drives orbits. */
export function driveVortices(sim: Sim, dt: number) {
  const funnels: PieceRt[] = [];
  for (const rt of sim.pieces.values()) {
    if (rt.piece.type === "funnel" && Math.abs(rt.piece.angle) <= MAX_UPRIGHT) funnels.push(rt);
  }
  for (const m of sim.marbles) {
    if (m.orbit) {
      const rt = sim.pieces.get(m.orbit.funnel);
      if (!rt || Math.abs(rt.piece.angle) > MAX_UPRIGHT) {
        m.orbit = null;
        m.depth = 0;
        m.body.collisionFilter.mask = 0xffffffff;
        continue;
      }
      advance(m, rt, dt);
      continue;
    }
    if (m.cool > 0) {
      m.cool -= dt;
      continue;
    }
    if (m.dying < 0 && funnels.length) tryCapture(sim, m, funnels);
  }
}
