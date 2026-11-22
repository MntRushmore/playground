// Collision responses: bumper kicks, spring launches, the cup sensor, switch arming,
// and impact events for sound. Matter fires collisionStart before solving, so velocities
// read here are pre-impact and velocities written here survive the solver (they separate).

import Matter from "matter-js";
import { stepVelocity, tagOf, type BodyTag } from "./bodies";
import { CUP_SENSOR } from "./geometry";
import { rad, toWorld } from "./transforms";
import type { MarbleRt } from "./marbles";
import { TICK, type PieceRt, type Sim } from "./physics";
import type { Material } from "./types";

const { Events, Body } = Matter;

/** Bumper and spring minimum outgoing speeds, u/s at 1g. Scaled by √g so arcs keep their shape. */
const BUMPER_KICK = 620;
const SPRING_MIN = 560;
/** Springs return this share of the incoming speed, so higher drops bounce higher. */
const SPRING_GAIN = 0.82;
const HIT_MIN = 70;
const SPARKLE_MIN = 950;

function velocity(b: Matter.Body) {
  return stepVelocity(b, TICK);
}

function setVelocity(b: Matter.Body, x: number, y: number) {
  Body.setVelocity(b, { x, y });
}

const MATERIAL: Record<string, Material> = {
  bumper: "bumper",
  spring: "spring",
  cup: "cup",
  wheel: "wheel",
  switch: "switch",
  lift: "lift",
};

type Resolved = { marble: MarbleRt; other: Matter.Body; otherTag: BodyTag | undefined; normal: Matter.Vector };

function resolvePair(sim: Sim, pair: Matter.Pair, byId: Map<number, MarbleRt>): Resolved | Resolved[] | null {
  const ta = tagOf(pair.bodyA);
  const tb = tagOf(pair.bodyB);
  const ma = ta?.kind === "marble" ? byId.get(ta.id) : undefined;
  const mb = tb?.kind === "marble" ? byId.get(tb.id) : undefined;
  const n = pair.collision.normal;
  if (ma && mb) {
    return [
      { marble: ma, other: pair.bodyB, otherTag: tb, normal: n },
      { marble: mb, other: pair.bodyA, otherTag: ta, normal: n },
    ];
  }
  if (ma) return { marble: ma, other: pair.bodyB, otherTag: tb, normal: n };
  if (mb) return { marble: mb, other: pair.bodyA, otherTag: ta, normal: { x: -n.x, y: -n.y } };
  void sim;
  return null;
}

/** A few tiny glints where a marble lands hard. */
function sparkle(sim: Sim, m: MarbleRt, n: Matter.Vector) {
  const { x, y } = m.body.position;
  // Point the normal from the marble into the surface it is moving towards.
  const v = velocity(m.body);
  const k = v.x * n.x + v.y * n.y >= 0 ? 1 : -1;
  const dx = n.x * k;
  const dy = n.y * k;
  for (let i = 0; i < 3; i++) {
    const a = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.6;
    const sp = 90 + Math.random() * 120;
    sim.sparks.push({ x: x + dx * m.radius, y: y + dy * m.radius, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, color: m.color });
  }
}

function onCup(sim: Sim, m: MarbleRt, rt: PieceRt) {
  if (m.cupAt >= 0) return;
  m.cupAt = sim.time;
  rt.flash = 1;
  // The tray's soft floor takes most of the energy: marbles settle instead of bouncing out.
  const v = velocity(m.body);
  setVelocity(m.body, v.x * 0.4, v.y * 0.4);
  sim.events.push({ kind: "cup" });
  const c = toWorld(rt.piece, CUP_SENSOR.x, CUP_SENSOR.y - CUP_SENSOR.h / 2);
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
    const sp = 160 + Math.random() * 180;
    sim.sparks.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: m.color });
  }
}

function kickBumper(sim: Sim, m: MarbleRt, rt: PieceRt) {
  const b = m.body;
  const nx = b.position.x - rt.piece.x;
  const ny = b.position.y - rt.piece.y;
  const len = Math.hypot(nx, ny) || 1;
  const v = velocity(b);
  const vn = (v.x * nx + v.y * ny) / len;
  const kick = (BUMPER_KICK / 60) * Math.sqrt(sim.settings.gravity);
  const out = Math.max(-vn * 0.85, kick);
  setVelocity(b, v.x - (nx / len) * vn + (nx / len) * out, v.y - (ny / len) * vn + (ny / len) * out);
  rt.flash = 1;
  m.kicked = true;
}

function launchSpring(sim: Sim, m: MarbleRt, rt: PieceRt) {
  const a = rad(rt.piece.angle);
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const b = m.body;
  // Only marbles landing on the pad's top face get launched.
  if ((b.position.x - rt.piece.x) * ux + (b.position.y - rt.piece.y) * uy < 0) return false;
  const v = velocity(b);
  const vn = v.x * ux + v.y * uy;
  if (vn > 0) return false;
  const launch = Math.max(-vn * SPRING_GAIN, (SPRING_MIN / 60) * Math.sqrt(sim.settings.gravity));
  // Half the sliding motion survives the bounce: physical, but keeps landings consistent.
  const vt = { x: (v.x - ux * vn) * 0.5, y: (v.y - uy * vn) * 0.5 };
  setVelocity(b, vt.x + ux * launch, vt.y + uy * launch);
  rt.flash = 1;
  m.kicked = true;
  return true;
}

export function attachCollisions(sim: Sim) {
  const index = () => new Map(sim.marbles.map((m) => [m.id, m]));

  Events.on(sim.engine, "collisionStart", (e) => {
    const byId = index();
    for (const pair of e.pairs) {
      const r = resolvePair(sim, pair, byId);
      if (!r) continue;
      if (Array.isArray(r)) {
        const [a, b] = [r[0].marble, r[1].marble];
        a.allow = Math.max(a.allow, b.pv);
        b.allow = Math.max(b.allow, a.pv);
        const va = velocity(a.body);
        const vb = velocity(b.body);
        const speed = Math.abs((va.x - vb.x) * r[0].normal.x + (va.y - vb.y) * r[0].normal.y) * 60;
        if (speed > HIT_MIN) sim.events.push({ kind: "hit", material: "glass", speed });
        continue;
      }
      const { marble: m, other, otherTag, normal } = r;
      if (!otherTag || otherTag.kind === "marble") continue;
      const rt = sim.pieces.get(otherTag.id);
      if (!rt) continue;
      if (otherTag.kind === "cup") {
        onCup(sim, m, rt);
        continue;
      }
      const v = velocity(m.body);
      const vo = velocity(other.parent ?? other);
      const speed = Math.abs((v.x - vo.x) * normal.x + (v.y - vo.y) * normal.y) * 60;
      const type = rt.piece.type;
      if (type === "bumper") kickBumper(sim, m, rt);
      else if (type === "spring" && other.label === "pad" && launchSpring(sim, m, rt)) {
        sim.events.push({ kind: "hit", material: "spring", speed: Math.max(speed, 600) });
        continue;
      }
      if (type === "switch") rt.armed = true;
      if (speed > SPARKLE_MIN) sparkle(sim, m, normal);
      if (speed > HIT_MIN || type === "bumper") {
        sim.events.push({ kind: "hit", material: MATERIAL[type] ?? "track", speed: Math.max(speed, type === "bumper" ? 500 : 0) });
      }
    }
  });

  Events.on(sim.engine, "collisionActive", (e) => {
    for (const pair of e.pairs) {
      if (pair.isSensor) continue;
      const ta = tagOf(pair.bodyA);
      const tb = tagOf(pair.bodyB);
      for (const [part, t, other] of [
        [pair.bodyA, ta, tb],
        [pair.bodyB, tb, ta],
      ] as const) {
        if (t?.kind !== "marble") continue;
        const m = sim.marbles.find((x) => x.id === t.id);
        if (!m) continue;
        m.touching = true;
        // Remember the supporting surface (the most upward-facing contact) and its velocity,
        // for rolling contact. Moving parts (cleats, wheels) carry the marble, not spin it.
        if (other?.kind === "piece") {
          const n = pair.collision.normal;
          const sp = pair.collision.supports[0] ?? part.position;
          const flip = (part.position.x - sp.x) * n.x + (part.position.y - sp.y) * n.y < 0 ? -1 : 1;
          const ny = n.y * flip;
          if ((m.nx === 0 && m.ny === 0) || ny < m.ny) {
            const body = part === pair.bodyA ? pair.bodyB : pair.bodyA;
            const sv = stepVelocity(body.parent ?? body, 1);
            m.nx = n.x * flip;
            m.ny = ny;
            m.svx = sv.x;
            m.svy = sv.y;
          }
        }
      }
    }
  });
}
