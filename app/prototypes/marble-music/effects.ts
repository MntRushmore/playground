// Hit juice: ripples, sparks and bar glow/wobble. Pure state updates.

import type { BarFx, Ripple, Spark } from "./types";

const MAX_SPARKS = 220;
const MAX_RIPPLES = 36;

export type Effects = { ripples: Ripple[]; sparks: Spark[] };

export const createEffects = (): Effects => ({ ripples: [], sparks: [] });

export const createBarFx = (delay = 0, appear = 0): BarFx => ({ glow: 0, wobble: 0, phase: 0, appear, delay });

/** Light up a bar: glow + a bend proportional to how hard it was struck. */
export function strikeBar(fx: BarFx, intensity: number, thickness: number) {
  fx.glow = Math.min(1, Math.max(fx.glow, 0.35 + intensity * 0.65));
  fx.wobble = Math.min(thickness * 0.9, fx.wobble + thickness * (0.25 + intensity * 0.6));
  fx.phase = 0;
}

export function spawnHit(
  e: Effects,
  x: number,
  y: number,
  nx: number,
  ny: number,
  degree: number,
  intensity: number,
  unit: number,
  rand: () => number = Math.random
) {
  if (e.ripples.length >= MAX_RIPPLES) e.ripples.shift();
  e.ripples.push({ x, y, degree, age: 0, life: 0.55 + intensity * 0.35, radius: unit * (0.04 + intensity * 0.06) });

  const count = Math.round(3 + intensity * 7);
  const base = Math.atan2(ny, nx);
  const speed = unit * 0.0045;
  for (let i = 0; i < count; i++) {
    if (e.sparks.length >= MAX_SPARKS) e.sparks.shift();
    const a = base + (rand() - 0.5) * 2.4;
    const v = speed * (0.4 + rand() * (0.6 + intensity));
    e.sparks.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      age: 0,
      life: 0.35 + rand() * 0.45,
      size: 1 + rand() * 1.6,
      degree,
    });
  }
}

/** Advance by dt seconds. `gravity` is in px per (1/60 s)². */
export function stepEffects(e: Effects, dt: number, gravity: number) {
  const f = dt * 60;
  for (const r of e.ripples) r.age += dt;
  e.ripples = e.ripples.filter((r) => r.age < r.life);
  for (const s of e.sparks) {
    s.age += dt;
    s.vx *= Math.pow(0.97, f);
    s.vy = s.vy * Math.pow(0.97, f) + gravity * 0.35 * f;
    s.x += s.vx * f;
    s.y += s.vy * f;
  }
  e.sparks = e.sparks.filter((s) => s.age < s.life);
}

/** Grow-in, then exponential decays for glow and wobble. */
export function stepBarFx(fx: BarFx, dt: number) {
  if (fx.delay > 0) {
    fx.delay -= dt;
  } else if (fx.appear < 1) {
    fx.appear = Math.min(1, fx.appear + dt / 0.5);
  }
  fx.glow *= Math.exp(-dt / 0.32);
  fx.wobble *= Math.exp(-dt / 0.22);
  fx.phase += dt * 2 * Math.PI * 16;
  if (fx.glow < 0.002) fx.glow = 0;
  if (fx.wobble < 0.05) fx.wobble = 0;
}

/** ease-out-quint, matching the app's motion token. */
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
