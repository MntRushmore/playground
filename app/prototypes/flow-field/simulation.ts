// Particle simulation. Pure functions over plain arrays, no DOM or React.

import type { Noise3D } from "./noise";
import type { Bounds, FlowSettings, Particle } from "./types";

const TAU = Math.PI * 2;
/** Converts the user-facing Zoom value to noise-space frequency per CSS pixel. */
const SCALE_FACTOR = 0.0009;

export function spawnParticle(b: Bounds, rand: () => number = Math.random): Particle {
  const x = rand() * b.width;
  const y = rand() * b.height;
  return { x, y, px: x, py: y, age: 0, life: 60 + rand() * 240, angle: 0 };
}

/** Grows or shrinks the pool to `count` without disturbing existing particles. */
export function resizePool(pool: Particle[], count: number, b: Bounds) {
  if (pool.length > count) pool.length = count;
  while (pool.length < count) {
    const p = spawnParticle(b);
    p.age = Math.random() * p.life; // stagger lifetimes so they don't respawn in sync
    pool.push(p);
  }
}

export function flowAngle(noise: Noise3D, x: number, y: number, time: number, s: FlowSettings) {
  const f = s.scale * SCALE_FACTOR;
  return noise(x * f, y * f, time) * TAU * s.turbulence;
}

/**
 * Advances every particle one frame. `dt` is in 60fps frames (1 = 16.7ms).
 * `pxScale` keeps visual speed consistent across canvas sizes.
 */
export function stepParticles(
  pool: Particle[],
  noise: Noise3D,
  time: number,
  s: FlowSettings,
  b: Bounds,
  dt: number,
  pxScale: number
) {
  const v = s.speed * pxScale * dt;
  for (const p of pool) {
    p.px = p.x;
    p.py = p.y;
    p.angle = flowAngle(noise, p.x, p.y, time, s);
    p.x += Math.cos(p.angle) * v;
    p.y += Math.sin(p.angle) * v;
    p.age += dt;

    const out = p.x < 0 || p.x > b.width || p.y < 0 || p.y > b.height;
    if (out || p.age > p.life) {
      const fresh = spawnParticle(b);
      p.x = p.px = fresh.x;
      p.y = p.py = fresh.y;
      p.age = 0;
      p.life = fresh.life;
    }
  }
}
