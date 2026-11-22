// Canvas drawing for bars and their selection handles. Pure functions of state.

import { GEOMETRY } from "./data";
import { easeOutQuint } from "./effects";
import { barEnds, knobPositions } from "./geometry";
import { noteColor } from "./music";
import type { BarFx, BarGeom, ThemeColors } from "./types";

/** Strokes the bar's center line, bent by its wobble (a struck bar flexes). */
function barPath(ctx: CanvasRenderingContext2D, g: BarGeom, scale: number, bend: number, inset = 0) {
  const e = barEnds(g, scale);
  const px = -e.uy;
  const py = e.ux;
  ctx.beginPath();
  ctx.moveTo(e.ax + e.ux * inset, e.ay + e.uy * inset);
  ctx.quadraticCurveTo(g.cx + px * bend * 2, g.cy + py * bend * 2, e.bx - e.ux * inset, e.by - e.uy * inset);
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  g: BarGeom,
  fx: BarFx,
  degree: number,
  theme: ThemeColors,
  selected: boolean,
  alpha = 1
) {
  const scale = easeOutQuint(fx.appear);
  if (scale <= 0.001 || alpha <= 0.001) return;
  const bend = fx.wobble * Math.sin(fx.phase);
  const t = g.thickness;
  const glow = fx.glow;
  ctx.save();
  ctx.globalAlpha = alpha * Math.min(1, scale * 1.5);
  ctx.lineCap = "round";

  if (selected) {
    barPath(ctx, g, scale, bend);
    ctx.strokeStyle = theme.foreground;
    ctx.globalAlpha = alpha * 0.14;
    ctx.lineWidth = t + 10;
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  // Body, with a soft bloom in the note's color while it rings.
  if (glow > 0.01) {
    ctx.shadowColor = noteColor(degree, theme.dark, 0.5, (theme.dark ? 0.95 : 0.75) * glow);
    ctx.shadowBlur = 6 + 22 * glow;
  }
  barPath(ctx, g, scale, bend);
  ctx.strokeStyle = noteColor(degree, theme.dark, glow, 1, 0.8 + 0.2 * glow);
  ctx.lineWidth = t;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  // Sheen along the upper edge so the bar reads as a rounded, polished tube.
  const e = barEnds(g, scale);
  const flip = e.ux > 0 ? -1 : 1; // perpendicular that points up the screen
  const px = -e.uy * flip;
  const py = e.ux * flip;
  ctx.save();
  ctx.translate(px * t * 0.2, py * t * 0.2);
  barPath(ctx, g, scale, bend, t * 0.45);
  ctx.strokeStyle = theme.dark ? `oklch(1 0 0 / ${0.22 + glow * 0.3})` : `oklch(1 0 0 / ${0.42 + glow * 0.2})`;
  ctx.lineWidth = Math.max(1.2, t * 0.22);
  ctx.stroke();
  ctx.restore();

  // Mounting pins at the bar's vibration nodes (22.4% in from each end), like a real xylophone.
  const node = g.length * scale * 0.276;
  const sway = bend * 0.7 * flip; // where the bent curve passes at the node
  ctx.fillStyle = theme.background;
  ctx.globalAlpha = alpha * 0.75;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(g.cx + e.ux * node * s + px * sway, g.cy + e.uy * node * s + py * sway, t * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function knob(ctx: CanvasRenderingContext2D, x: number, y: number, theme: ThemeColors, active: boolean) {
  const r = GEOMETRY.knobRadius;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.background;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = active ? 0.9 : 0.45;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = theme.foreground;
  ctx.stroke();
  ctx.globalAlpha = 0.85;
}

/** Rotate/stretch knob on one end, delete knob on the other, plus the note name while tuning. */
export function drawHandles(
  ctx: CanvasRenderingContext2D,
  g: BarGeom,
  theme: ThemeColors,
  activeKnob: "rotate" | null,
  label: string | null,
  viewWidth: number,
  viewHeight: number
) {
  const k = knobPositions(g, { width: viewWidth, height: viewHeight });
  const e = barEnds(g);
  ctx.save();
  ctx.lineCap = "round";

  // Tether lines from bar ends to knobs.
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = theme.foreground;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(e.bx + e.ux * g.thickness * 0.7, e.by + e.uy * g.thickness * 0.7);
  ctx.lineTo(k.rotate.x - e.ux * GEOMETRY.knobRadius, k.rotate.y - e.uy * GEOMETRY.knobRadius);
  ctx.moveTo(e.ax - e.ux * g.thickness * 0.7, e.ay - e.uy * g.thickness * 0.7);
  ctx.lineTo(k.remove.x + e.ux * GEOMETRY.knobRadius, k.remove.y + e.uy * GEOMETRY.knobRadius);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rotate glyph: a circular arrow.
  knob(ctx, k.rotate.x, k.rotate.y, theme, activeKnob === "rotate");
  const gr = 5;
  const start = -Math.PI * 0.15;
  const end = Math.PI * 1.35;
  ctx.beginPath();
  ctx.arc(k.rotate.x, k.rotate.y, gr, start, end);
  ctx.stroke();
  const ax = k.rotate.x + Math.cos(end) * gr;
  const ay = k.rotate.y + Math.sin(end) * gr;
  ctx.beginPath();
  ctx.moveTo(ax + 3.2, ay - 0.6);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + 0.6, ay - 3.4);
  ctx.stroke();

  // Delete glyph: ×.
  knob(ctx, k.remove.x, k.remove.y, theme, false);
  const d = 3.6;
  ctx.beginPath();
  ctx.moveTo(k.remove.x - d, k.remove.y - d);
  ctx.lineTo(k.remove.x + d, k.remove.y + d);
  ctx.moveTo(k.remove.x + d, k.remove.y - d);
  ctx.lineTo(k.remove.x - d, k.remove.y + d);
  ctx.stroke();

  if (label) drawLabel(ctx, k.rotate.x, k.rotate.y - GEOMETRY.knobRadius - 16, label, theme, viewWidth);
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  theme: ThemeColors,
  viewWidth: number
) {
  ctx.font = `600 12px ${theme.font}`;
  const w = ctx.measureText(text).width + 14;
  const h = 22;
  const lx = Math.min(Math.max(x, w / 2 + 4), viewWidth - w / 2 - 4);
  const ly = Math.max(y, h / 2 + 4);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = theme.foreground;
  ctx.beginPath();
  ctx.roundRect(lx - w / 2, ly - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.background;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, lx, ly + 0.5);
}
