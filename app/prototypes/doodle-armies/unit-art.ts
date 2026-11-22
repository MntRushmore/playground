// Draws one hand-inked unit doodle. Each kind has a distinct silhouette so armies
// read at a glance. Pure 2D-canvas drawing in screen pixels.

import { blobPath, roughArc, roughLine } from "./rough";
import type { UnitKind } from "./types";

export type UnitStyle = {
  /** Dark ink line color (hex). */
  ink: string;
  /** Translucent body fill (rgba). */
  fill: string;
  /** Heal accent (hex). */
  heal: string;
  /** Foreground token (for eyes + HP bar). */
  fg: string;
};

export type DrawUnit = {
  x: number;
  y: number;
  r: number;
  kind: UnitKind;
  hpFrac: number;
  flash: number;
  wob: number;
};

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function glyph(ctx: CanvasRenderingContext2D, d: DrawUnit, s: UnitStyle, lw: number) {
  const { x, y, r, kind } = d;
  ctx.strokeStyle = s.ink;
  ctx.lineWidth = lw;
  ctx.beginPath();
  switch (kind) {
    case "swordsman":
      roughLine(ctx, x - r * 0.1, y + r * 0.4, x + r * 1.0, y - r * 1.0, r * 0.1, d.wob);
      roughLine(ctx, x + r * 0.3, y - r * 0.1, x + r * 0.75, y - r * 0.3, r * 0.05, d.wob + 3);
      ctx.stroke();
      break;
    case "archer":
      roughArc(ctx, x - r * 0.2, y, r * 1.15, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      roughLine(ctx, x - r * 0.2 + Math.cos(-0.9) * r * 1.15, y + Math.sin(-0.9) * r * 1.15,
        x - r * 0.2 + Math.cos(0.9) * r * 1.15, y + Math.sin(0.9) * r * 1.15, r * 0.05, d.wob);
      ctx.stroke();
      break;
    case "cavalry":
      roughLine(ctx, x - r * 0.9, y + r * 0.1, x + r * 1.3, y - r * 0.8, r * 0.08, d.wob);
      ctx.stroke();
      ctx.beginPath(); // small banner at the lance tip
      ctx.moveTo(x + r * 1.3, y - r * 0.8);
      ctx.lineTo(x + r * 1.5, y - r * 1.0);
      ctx.lineTo(x + r * 1.5, y - r * 0.55);
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
      ctx.stroke();
      break;
    case "healer": {
      ctx.strokeStyle = s.heal;
      ctx.lineWidth = Math.max(lw, r * 0.26);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.55);
      ctx.lineTo(x, y + r * 0.55);
      ctx.moveTo(x - r * 0.55, y);
      ctx.lineTo(x + r * 0.55, y);
      ctx.stroke();
      break;
    }
    case "knight":
      roughArc(ctx, x, y - r * 0.1, r * 0.95, 0.35, Math.PI - 0.35); // shield belly
      ctx.stroke();
      ctx.beginPath();
      roughLine(ctx, x, y - r * 0.9, x, y + r * 0.8, r * 0.05, d.wob); // crease
      ctx.stroke();
      break;
    case "mage":
      ctx.beginPath(); // pointy hat
      ctx.moveTo(x - r * 0.75, y - r * 0.5);
      ctx.lineTo(x, y - r * 1.95);
      ctx.lineTo(x + r * 0.75, y - r * 0.5);
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath(); // staff
      roughLine(ctx, x + r * 0.5, y + r * 0.9, x + r * 1.0, y - r * 1.1, r * 0.06, d.wob);
      ctx.stroke();
      ctx.fillStyle = s.ink;
      dot(ctx, x + r * 1.0, y - r * 1.15, r * 0.26);
      break;
    case "giant":
      ctx.beginPath(); // brows
      roughLine(ctx, x - r * 0.55, y - r * 0.35, x - r * 0.15, y - r * 0.2, r * 0.04, d.wob);
      roughLine(ctx, x + r * 0.15, y - r * 0.2, x + r * 0.55, y - r * 0.35, r * 0.04, d.wob + 2);
      ctx.stroke();
      ctx.beginPath(); // club
      roughLine(ctx, x + r * 0.4, y + r * 0.3, x + r * 1.2, y - r * 0.8, r * 0.1, d.wob);
      ctx.stroke();
      ctx.fillStyle = s.fill;
      ctx.beginPath();
      ctx.arc(x + r * 1.3, y - r * 0.9, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
}

function eyes(ctx: CanvasRenderingContext2D, d: DrawUnit, s: UnitStyle) {
  if (d.r < 7) return;
  const er = Math.max(1, d.r * 0.11);
  const ey = d.y - d.r * 0.12;
  ctx.fillStyle = s.fg;
  dot(ctx, d.x - d.r * 0.32, ey, er);
  dot(ctx, d.x + d.r * 0.32, ey, er);
}

export function drawUnit(
  ctx: CanvasRenderingContext2D,
  d: DrawUnit,
  s: UnitStyle,
  phase: number
) {
  const pop = 1 + Math.max(0, d.flash) * 0.45;
  const r = d.r * pop;
  const jitter = 0.085;
  const lw = Math.max(1.3, r * 0.15);

  // Body
  blobPath(ctx, d.x, d.y, r, jitter, d.wob, phase + d.wob, 11);
  ctx.fillStyle = s.fill;
  ctx.fill();
  ctx.strokeStyle = s.ink;
  ctx.lineWidth = lw;
  ctx.stroke();

  if (d.kind !== "healer" && d.kind !== "giant") eyes(ctx, d, s);
  if (d.kind === "giant") eyes(ctx, { ...d, r: d.r * 1.15 }, s);

  glyph(ctx, d, s, Math.max(1.2, r * 0.13));

  // Hit flash: a bright ink ring pulse.
  if (d.flash > 0) {
    ctx.globalAlpha = Math.min(1, d.flash * 4);
    blobPath(ctx, d.x, d.y, r * 1.25, 0.06, d.wob + 9, phase + d.wob, 10);
    ctx.strokeStyle = s.ink;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // HP bar when wounded.
  if (d.hpFrac < 0.999 && d.hpFrac > 0) {
    const bw = d.r * 2.1;
    const bh = Math.max(2, d.r * 0.2);
    const bx = d.x - bw / 2;
    const by = d.y + d.r + bh + 1.5;
    ctx.fillStyle = s.fg;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.ink;
    ctx.fillRect(bx, by, bw * d.hpFrac, bh);
  }
}
