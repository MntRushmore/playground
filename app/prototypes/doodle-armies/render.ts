// Scene renderer: paper background, grid, team washes, then the inked entities
// (ground splats + rings, units, projectiles, poofs, floating numbers). Pure
// drawing in screen pixels; the canvas component owns the DPR transform.

import { GRID_CELL } from "./data";
import { healInk, hexA, teamInk, teamWash } from "./palette";
import { hash } from "./rough";
import { drawUnit, type DrawUnit, type UnitStyle } from "./unit-art";
import { stats } from "./units";
import type { Effect, PlacedUnit, Projectile, Team, ThemeInk, Unit, World } from "./types";

export type RenderInput = { phase: "draw" | "battle" | "ended"; world: World; roster: PlacedUnit[] };
export type View = { scale: number; theme: ThemeInk; time: number; wobble: boolean };

function styles(theme: ThemeInk): Record<Team, UnitStyle> {
  const a = theme.dark ? 0.4 : 0.5;
  const mk = (t: Team): UnitStyle => ({
    ink: teamInk(t, theme.dark),
    fill: hexA(teamWash(t, theme.dark), a),
    heal: healInk(theme.dark),
    fg: theme.foreground,
  });
  return { blue: mk("blue"), red: mk("red") };
}

function paper(ctx: CanvasRenderingContext2D, w: number, h: number, theme: ThemeInk) {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, w, h);
  // Faint team home washes.
  ctx.globalAlpha = theme.dark ? 0.1 : 0.07;
  ctx.fillStyle = teamWash("blue", theme.dark);
  ctx.fillRect(0, 0, w / 2, h);
  ctx.fillStyle = teamWash("red", theme.dark);
  ctx.fillRect(w / 2, 0, w / 2, h);
  ctx.globalAlpha = 1;
  // Grid.
  const step = Math.max(26, GRID_CELL * 0.6);
  ctx.strokeStyle = theme.foreground;
  ctx.globalAlpha = theme.dark ? 0.06 : 0.05;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  // Centre line.
  ctx.globalAlpha = theme.dark ? 0.16 : 0.13;
  ctx.setLineDash([6, 9]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function groundEffect(ctx: CanvasRenderingContext2D, e: Effect, s: number, theme: ThemeInk) {
  const t = e.age / e.life;
  const ink = e.team ? teamInk(e.team, theme.dark) : theme.foreground;
  if (e.kind === "splat") {
    ctx.fillStyle = ink;
    const blobs = 6;
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + e.seed;
      const spread = (e.r0 + (e.r1 - e.r0) * Math.min(1, t * 2)) * (0.4 + hash(e.seed + i));
      const bx = (e.x + Math.cos(a) * spread) * s;
      const by = (e.y + Math.sin(a) * spread) * s;
      const br = (1 + hash(e.seed + i * 3) * 2.4) * s;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (e.kind === "ring") {
    const r = (e.r0 + (e.r1 - e.r0) * t) * s;
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x * s, e.y * s, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function airEffect(ctx: CanvasRenderingContext2D, e: Effect, s: number, theme: ThemeInk) {
  const t = e.age / e.life;
  if (e.kind === "poof") {
    const r = (e.r0 + (e.r1 - e.r0) * t) * s;
    ctx.globalAlpha = (1 - t) * 0.5;
    ctx.strokeStyle = e.team ? teamInk(e.team, theme.dark) : theme.foreground;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(e.x * s, e.y * s, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else if (e.kind === "number") {
    const size = Math.max(11, 13 * s);
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = e.heal ? `+${e.value}` : `${e.value}`;
    const color = e.heal ? healInk(theme.dark) : e.team ? teamInk(e.team, theme.dark) : theme.foreground;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.background;
    ctx.strokeText(label, e.x * s, e.y * s);
    ctx.fillStyle = color;
    ctx.fillText(label, e.x * s, e.y * s);
    ctx.globalAlpha = 1;
  }
}

function projectile(ctx: CanvasRenderingContext2D, p: Projectile, s: number, theme: ThemeInk) {
  const ink = teamInk(p.team, theme.dark);
  const x = p.x * s;
  const y = p.y * s;
  const ang = Math.atan2(p.vy, p.vx);
  if (p.aoeRadius > 0) {
    // Mage orb.
    ctx.fillStyle = hexA(teamWash(p.team, theme.dark), theme.dark ? 0.6 : 0.65);
    ctx.beginPath();
    ctx.arc(x, y, 5.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    // Archer arrow.
    const len = 15 * s;
    const hx = x + Math.cos(ang) * len * 0.5;
    const hy = y + Math.sin(ang) * len * 0.5;
    const tx = x - Math.cos(ang) * len * 0.5;
    const ty = y - Math.sin(ang) * len * 0.5;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.lineTo(hx - Math.cos(ang - 0.5) * 5 * s, hy - Math.sin(ang - 0.5) * 5 * s);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - Math.cos(ang + 0.5) * 5 * s, hy - Math.sin(ang + 0.5) * 5 * s);
    ctx.stroke();
  }
}

export function renderScene(ctx: CanvasRenderingContext2D, input: RenderInput, view: View) {
  const { world, roster, phase } = input;
  const s = view.scale;
  const w = world.bounds.width * s;
  const h = world.bounds.height * s;
  paper(ctx, w, h, view.theme);

  const st = styles(view.theme);
  const phaseT = view.wobble ? view.time * 2.1 : 0;

  ctx.save();
  const sh = view.wobble ? world.shake * s : 0;
  if (sh > 0.1) ctx.translate((Math.random() - 0.5) * sh * 2, (Math.random() - 0.5) * sh * 2);

  for (const e of world.effects) groundEffect(ctx, e, s, view.theme);

  const drawOne = (team: Team, kind: DrawUnit["kind"], x: number, y: number, hpFrac: number, flash: number, wob: number) => {
    const r = stats(kind).radius * s;
    drawUnit(ctx, { x: x * s, y: y * s, r, kind, hpFrac, flash, wob }, st[team], phaseT);
  };

  if (phase === "draw") {
    roster.forEach((u, i) => drawOne(u.team, u.kind, u.x, u.y, 1, 0, i * 11.3));
  } else {
    const units: Unit[] = world.units;
    for (const u of units) {
      if (u.dead) continue;
      drawOne(u.team, u.kind, u.x, u.y, u.hp / u.maxHp, Math.max(0, u.flash), u.wob);
    }
  }

  for (const p of world.projectiles) if (!p.dead) projectile(ctx, p, s, view.theme);
  for (const e of world.effects) airEffect(ctx, e, s, view.theme);

  ctx.restore();
}
