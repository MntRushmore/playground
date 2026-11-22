// Matter.js world: static bars, side walls, marbles, and bar contacts. No DOM, no React.

import Matter from "matter-js";
import { PHYSICS } from "./data";
import type { BarGeom, Contact, Size } from "./types";

const { Engine, Bodies, Body, Composite, Events } = Matter;

type BarEntry = { body: Matter.Body; length: number; thickness: number };

export type Physics = {
  engine: Matter.Engine;
  bars: Map<string, BarEntry>;
  marbles: Map<number, Matter.Body>;
  walls: Matter.Body[];
  restitution: number;
  handler: (event: Matter.IEventCollision<Matter.Engine>) => void;
};

const BAR_PREFIX = "bar:";

export function createPhysics(onContact: (c: Contact) => void): Physics {
  const engine = Engine.create({
    gravity: { x: 0, y: 1, scale: PHYSICS.gravityScale },
    positionIterations: 8,
    velocityIterations: 6,
  });
  // collisionStart fires before the solver runs, so velocities are still pre-impact.
  const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const barBody = a.label.startsWith(BAR_PREFIX) ? a : b.label.startsWith(BAR_PREFIX) ? b : null;
      const marble = a.label === "marble" ? a : b.label === "marble" ? b : null;
      if (!barBody || !marble) continue;
      const c = pair.collision;
      const v = Body.getVelocity(marble);
      let nx = c.normal.x;
      let ny = c.normal.y;
      // Matter 0.20 keeps a fixed 2-slot supports array; supportCount isn't in the typings.
      const count = (c as { supportCount?: number }).supportCount ?? c.supports.length;
      const support = count > 0 && c.supports[0] ? c.supports[0] : marble.position;
      // Orient the normal from bar toward marble.
      if ((marble.position.x - barBody.position.x) * nx + (marble.position.y - barBody.position.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const speed = Math.abs(v.x * nx + v.y * ny) * 60; // per-16.7ms → per second
      onContact({
        barId: barBody.label.slice(BAR_PREFIX.length),
        marbleId: marble.id,
        speed,
        x: support.x,
        y: support.y,
        nx,
        ny,
      });
    }
  };
  Events.on(engine, "collisionStart", handler);
  return { engine, bars: new Map(), marbles: new Map(), walls: [], restitution: 0.6, handler };
}

/** Side walls keep marbles in view; the bottom is open. */
export function setBounds(p: Physics, size: Size) {
  for (const w of p.walls) Composite.remove(p.engine.world, w);
  const t = 200;
  const h = size.height * 4;
  p.walls = [
    Bodies.rectangle(-t / 2, size.height / 2, t, h, { isStatic: true, label: "wall", friction: 0 }),
    Bodies.rectangle(size.width + t / 2, size.height / 2, t, h, { isStatic: true, label: "wall", friction: 0 }),
  ];
  Composite.add(p.engine.world, p.walls);
}

/** Adds, moves or rebuilds bar bodies so the world matches `geoms`. */
export function syncBars(p: Physics, geoms: Map<string, BarGeom>) {
  for (const [id, entry] of p.bars) {
    if (!geoms.has(id)) {
      Composite.remove(p.engine.world, entry.body);
      p.bars.delete(id);
    }
  }
  for (const [id, g] of geoms) {
    const entry = p.bars.get(id);
    if (entry && Math.abs(entry.length - g.length) < 0.5 && Math.abs(entry.thickness - g.thickness) < 0.5) {
      Body.setPosition(entry.body, { x: g.cx, y: g.cy });
      Body.setAngle(entry.body, g.angle);
      continue;
    }
    if (entry) Composite.remove(p.engine.world, entry.body);
    const body = Bodies.rectangle(g.cx, g.cy, g.length, g.thickness, {
      isStatic: true,
      angle: g.angle,
      label: BAR_PREFIX + id,
      chamfer: { radius: g.thickness / 2 - 0.5 },
      restitution: p.restitution,
      friction: 0.04,
    });
    Composite.add(p.engine.world, body);
    p.bars.set(id, { body, length: g.length, thickness: g.thickness });
  }
}

export function addMarble(p: Physics, x: number, y: number, radius: number) {
  const body = Bodies.circle(x, y, radius, {
    label: "marble",
    restitution: p.restitution,
    friction: 0.006,
    frictionStatic: 0,
    frictionAir: 0.0005,
    density: 0.002,
  });
  Composite.add(p.engine.world, body);
  p.marbles.set(body.id, body);
  return body;
}

export function removeMarble(p: Physics, id: number) {
  const body = p.marbles.get(id);
  if (!body) return;
  Composite.remove(p.engine.world, body);
  p.marbles.delete(id);
}

export function setRestitution(p: Physics, r: number) {
  if (Math.abs(p.restitution - r) < 1e-4) return;
  p.restitution = r;
  for (const { body } of p.bars.values()) body.restitution = r;
  for (const body of p.marbles.values()) body.restitution = r;
}

/** Gravity scales with canvas height so a fall takes the same time on any screen. */
export function setGravity(p: Physics, gravity: number, size: Size) {
  const k = Math.min(1.5, Math.max(0.55, size.height / PHYSICS.refHeight));
  p.engine.gravity.scale = PHYSICS.gravityScale * gravity * k;
}

/** One fixed step, then clamp marble speed so nothing tunnels through a thin bar. */
export function stepPhysics(p: Physics, maxSpeedPerStep: number) {
  Engine.update(p.engine, PHYSICS.stepMs);
  for (const body of p.marbles.values()) {
    const v = Body.getVelocity(body);
    const perStep = Math.hypot(v.x, v.y) * (PHYSICS.stepMs / (1000 / 60));
    if (perStep > maxSpeedPerStep) {
      const k = maxSpeedPerStep / perStep;
      Body.setVelocity(body, { x: v.x * k, y: v.y * k });
    }
  }
}

/** Rescale marbles (position, size, speed) when the canvas changes size. */
export function rescaleMarbles(p: Physics, sx: number, sy: number) {
  const k = Math.sqrt(sx * sy);
  for (const body of p.marbles.values()) {
    const v = Body.getVelocity(body);
    Body.setPosition(body, { x: body.position.x * sx, y: body.position.y * sy });
    Body.scale(body, k, k);
    Body.setVelocity(body, { x: v.x * sx, y: v.y * sy });
  }
}

export function speedOf(body: Matter.Body) {
  return Body.getSpeed(body) * 60;
}

export function destroyPhysics(p: Physics) {
  Events.off(p.engine, "collisionStart", p.handler);
  Composite.clear(p.engine.world, false);
  Engine.clear(p.engine);
}
