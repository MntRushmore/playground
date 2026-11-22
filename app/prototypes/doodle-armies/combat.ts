// The simulation step: pure functions over the mutable World. No DOM, no React.
// Fixed-timestep so a battle is deterministic given a seed. Effects are cosmetic
// (gated by `juice`) and never change the outcome.

import { BATTLE_TIMEOUT } from "./data";
import type { Rng } from "./rng";
import type { Grid } from "./spatial-grid";
import { reach, stats } from "./units";
import type { Team, Unit, Winner, World } from "./types";

const MAX_RINGS = 48;
const SEP_QUERY = 60;
const SEP_WEIGHT = 1.7;
const STEER = 0.55; // velocity smoothing per step (0 = frozen, 1 = instant)
const SHAKE_DECAY = 55;
const SHAKE_CAP = 15;

const LIFE = { number: 0.8, splat: 0.6, poof: 0.34, ring: 0.42 } as const;

function pushNumber(w: World, u: Unit, value: number, heal: boolean, juice: boolean) {
  if (!juice) return;
  w.effects.push({
    kind: "number",
    x: u.x + (heal ? -4 : 4),
    y: u.y - 10,
    vx: 0,
    vy: -42,
    age: 0,
    life: LIFE.number,
    team: u.team,
    value: Math.round(value),
    heal,
    r0: 0,
    r1: 0,
    seed: (u.id * 2654435761) >>> 0,
  });
}

function kill(w: World, u: Unit, juice: boolean) {
  if (u.dead) return;
  u.dead = true;
  u.target = null;
  if (!juice) return;
  const r = stats(u.kind).radius;
  w.effects.push({
    kind: "splat",
    x: u.x,
    y: u.y,
    vx: 0,
    vy: 0,
    age: 0,
    life: LIFE.splat,
    team: u.team,
    value: 0,
    heal: false,
    r0: r,
    r1: r * 2.6,
    seed: (u.id * 40503) >>> 0,
  });
  w.effects.push({
    kind: "poof",
    x: u.x,
    y: u.y,
    vx: 0,
    vy: 0,
    age: 0,
    life: LIFE.poof,
    team: u.team,
    value: 0,
    heal: false,
    r0: r,
    r1: r * 3.2,
    seed: 0,
  });
}

function damage(w: World, victim: Unit, amount: number, juice: boolean, shake: number) {
  victim.hp -= amount;
  victim.flash = 0.13;
  pushNumber(w, victim, amount, false, juice);
  if (juice && shake > 0) w.shake = Math.min(SHAKE_CAP, w.shake + shake);
  if (victim.hp <= 0) kill(w, victim, juice);
}

/** Heal the most-injured living ally within range; returns true if it healed. */
function healNearby(w: World, grid: Grid, u: Unit, juice: boolean): boolean {
  const s = stats(u.kind);
  let best: Unit | null = null;
  let worst = 0.98; // only heal allies below 98% hp
  grid.forNeighbors(u.x, u.y, s.range, (n) => {
    if (n.dead || n.team !== u.team || n === u) return;
    const dx = n.x - u.x;
    const dy = n.y - u.y;
    if (dx * dx + dy * dy > s.range * s.range) return;
    const frac = n.hp / n.maxHp;
    if (frac < worst) {
      worst = frac;
      best = n;
    }
  });
  if (!best) return false;
  const ally = best as Unit;
  ally.hp = Math.min(ally.maxHp, ally.hp + s.damage);
  pushNumber(w, ally, s.damage, true, juice);
  return true;
}

function spawnProjectile(w: World, u: Unit, target: Unit) {
  const s = stats(u.kind);
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = s.projectileSpeed ?? 360;
  w.projectiles.push({
    team: u.team,
    kind: u.kind,
    x: u.x,
    y: u.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    target,
    tx: target.x,
    ty: target.y,
    damage: s.damage,
    aoeRadius: s.aoeRadius ?? 0,
    speed,
    life: 2.5,
    dead: false,
  });
}

function stepUnit(w: World, grid: Grid, rng: Rng, dt: number, u: Unit, juice: boolean) {
  const s = stats(u.kind);
  u.cd -= dt;
  u.flash -= dt;
  u.retarget -= dt;

  // Re-acquire a target. Healers track the nearest enemy so they advance with
  // the army, but they attack by healing allies, never by striking enemies.
  if (u.retarget <= 0 || !u.target || u.target.dead) {
    u.target = grid.nearestEnemy(u.x, u.y, u.team, MAX_RINGS);
    u.retarget = 0.28 + rng.next() * 0.16;
  }

  let dvx = 0;
  let dvy = 0;
  const t = u.target;
  if (t) {
    const dx = t.x - u.x;
    const dy = t.y - u.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const atkRange = s.style === "heal" ? 150 : reach(s, stats(t.kind).radius);

    if (s.style === "ranged" || s.style === "aoe") {
      if (dist > atkRange * 0.94) {
        dvx = nx * s.moveSpeed;
        dvy = ny * s.moveSpeed;
      } else if (dist < atkRange * 0.55) {
        dvx = -nx * s.moveSpeed * 0.8; // kite away when crowded
        dvy = -ny * s.moveSpeed * 0.8;
      }
    } else if (s.style === "heal") {
      if (dist > 168) {
        dvx = nx * s.moveSpeed;
        dvy = ny * s.moveSpeed;
      }
    } else if (dist > atkRange) {
      dvx = nx * s.moveSpeed;
      dvy = ny * s.moveSpeed;
    }

    // Attack when ready and in range.
    if (u.cd <= 0) {
      if (s.style === "heal") {
        if (healNearby(w, grid, u, juice)) u.cd = 1 / s.attackSpeed;
        else u.cd = 0.25;
      } else if (dist <= atkRange) {
        if (s.style === "melee") {
          damage(w, t, s.damage, juice, s.kind === "giant" ? 7 : 0);
          if (s.cleaveRadius && s.cleaveFrac) {
            const cr = s.cleaveRadius;
            const cd = s.damage * s.cleaveFrac;
            grid.forNeighbors(t.x, t.y, cr, (n) => {
              if (n.dead || n === t || n.team === u.team) return;
              const ex = n.x - t.x;
              const ey = n.y - t.y;
              if (ex * ex + ey * ey <= cr * cr) damage(w, n, cd, juice, 0);
            });
          }
        } else {
          spawnProjectile(w, u, t);
        }
        u.cd = 1 / s.attackSpeed;
      }
    }
  }

  // Separation: push off anything overlapping (allies hard, enemies soft so
  // melee can still make contact).
  let sx = 0;
  let sy = 0;
  grid.forNeighbors(u.x, u.y, SEP_QUERY, (n) => {
    if (n === u || n.dead) return;
    const dx = u.x - n.x;
    const dy = u.y - n.y;
    const d2 = dx * dx + dy * dy;
    const minD = (s.radius + stats(n.kind).radius) * (n.team === u.team ? 1.1 : 0.82);
    if (d2 > minD * minD) return;
    if (d2 < 0.01) {
      sx += rng.spread();
      sy += rng.spread();
      return;
    }
    const d = Math.sqrt(d2);
    const f = (minD - d) / minD;
    sx += (dx / d) * f;
    sy += (dy / d) * f;
  });
  dvx += sx * s.moveSpeed * SEP_WEIGHT;
  dvy += sy * s.moveSpeed * SEP_WEIGHT;

  // Clamp desired velocity, smooth, integrate.
  const dsp = Math.hypot(dvx, dvy);
  const max = s.moveSpeed * 1.2;
  if (dsp > max) {
    dvx = (dvx / dsp) * max;
    dvy = (dvy / dsp) * max;
  }
  u.vx += (dvx - u.vx) * STEER;
  u.vy += (dvy - u.vy) * STEER;
  u.x += u.vx * dt;
  u.y += u.vy * dt;

  const b = w.bounds;
  u.x = Math.max(s.radius, Math.min(b.width - s.radius, u.x));
  u.y = Math.max(s.radius, Math.min(b.height - s.radius, u.y));
}

function stepProjectiles(w: World, grid: Grid, dt: number, juice: boolean) {
  for (const p of w.projectiles) {
    if (p.dead) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.dead = true;
      continue;
    }
    const alive = p.target && !p.target.dead;
    const aimX = alive ? p.target!.x : p.tx;
    const aimY = alive ? p.target!.y : p.ty;
    if (alive) {
      p.tx = aimX;
      p.ty = aimY;
    }
    const dx = aimX - p.x;
    const dy = aimY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const hitR = (alive ? stats(p.target!.kind).radius : 6) + 5;
    const stepLen = p.speed * dt;
    if (d <= hitR + stepLen) {
      // Impact.
      if (p.aoeRadius > 0) {
        grid.forNeighbors(aimX, aimY, p.aoeRadius, (n) => {
          if (n.dead || n.team === p.team) return;
          const ex = n.x - aimX;
          const ey = n.y - aimY;
          if (ex * ex + ey * ey <= p.aoeRadius * p.aoeRadius) damage(w, n, p.damage, juice, 0);
        });
        if (juice) {
          w.shake = Math.min(SHAKE_CAP, w.shake + 5);
          w.effects.push({
            kind: "ring",
            x: aimX,
            y: aimY,
            vx: 0,
            vy: 0,
            age: 0,
            life: LIFE.ring,
            team: p.team,
            value: 0,
            heal: false,
            r0: 6,
            r1: p.aoeRadius,
            seed: 0,
          });
        }
      } else if (alive) {
        damage(w, p.target!, p.damage, juice, 0);
      }
      p.dead = true;
    } else {
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
    }
  }
}

function stepEffects(w: World, dt: number) {
  for (const e of w.effects) {
    e.age += dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vy += 26 * dt; // numbers ease their rise
  }
  if (w.effects.length > 0) w.effects = w.effects.filter((e) => e.age < e.life);
}

/** Advance the whole world one fixed step. */
export function stepWorld(
  w: World,
  grid: Grid,
  rng: Rng,
  dt: number,
  juice: boolean
) {
  w.time += dt;
  grid.build(w.units);
  for (const u of w.units) if (!u.dead) stepUnit(w, grid, rng, dt, u, juice);
  stepProjectiles(w, grid, dt, juice);
  stepEffects(w, dt);
  w.shake = Math.max(0, w.shake - SHAKE_DECAY * dt);
  if (w.projectiles.length > 0) w.projectiles = w.projectiles.filter((p) => !p.dead);
}

/** Advance only the cosmetic layer (effects + shake). Used after a battle ends. */
export function settleWorld(w: World, dt: number) {
  stepEffects(w, dt);
  w.shake = Math.max(0, w.shake - SHAKE_DECAY * dt);
}

export function countAlive(units: Unit[], team: Team): number {
  let n = 0;
  for (const u of units) if (!u.dead && u.team === team) n++;
  return n;
}

function totalHp(units: Unit[], team: Team): number {
  let hp = 0;
  for (const u of units) if (!u.dead && u.team === team) hp += u.hp;
  return hp;
}

/** Resolve a winner, or null if the battle continues. Timeout breaks stalemates. */
export function battleResult(w: World): Winner | null {
  const blue = countAlive(w.units, "blue");
  const red = countAlive(w.units, "red");
  if (blue === 0 && red === 0) return "draw";
  if (red === 0) return "blue";
  if (blue === 0) return "red";
  if (w.time >= BATTLE_TIMEOUT) {
    const bh = totalHp(w.units, "blue");
    const rh = totalHp(w.units, "red");
    if (Math.abs(bh - rh) < 1) return "draw";
    return bh > rh ? "blue" : "red";
  }
  return null;
}
