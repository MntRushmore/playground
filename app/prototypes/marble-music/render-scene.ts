// Canvas drawing for the backdrop, emitters, marbles and hit effects. Pure functions of state.

import type { Effects } from "./effects";
import { noteColor } from "./music";
import type { MarbleState, Size, ThemeColors } from "./types";

const TAU = Math.PI * 2;

/**
 * Pegboard dot grid over the stage (where bars can live), rendered once per
 * size/theme into an offscreen canvas.
 */
export function makeBackdrop(size: Size, stage: { x: number; width: number }, dpr: number, theme: ThemeColors) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(size.width * dpr));
  c.height = Math.max(1, Math.round(size.height * dpr));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, size.width, size.height);
  const gap = 22;
  const ox = stage.x + (stage.width % gap) / 2;
  const oy = (size.height % gap) / 2;
  ctx.fillStyle = theme.foreground;
  ctx.globalAlpha = theme.dark ? 0.075 : 0.1;
  for (let x = ox; x <= stage.x + stage.width; x += gap) {
    for (let y = oy; y <= size.height; y += gap) {
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, TAU);
      ctx.fill();
    }
  }
  return c;
}

/**
 * An emitter: a ring whose arc fills until the next drop while the next marble
 * "loads" in the middle; `pulse` is a 1→0 ring burst right after a drop.
 */
export function drawEmitter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  marbleR: number,
  progress: number,
  pulse: number,
  appear: number,
  theme: ThemeColors
) {
  if (appear <= 0.001) return;
  const r = Math.max(13, marbleR + 7) * appear;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = theme.foreground;

  ctx.globalAlpha = 0.16 * appear;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();

  if (progress > 0) {
    ctx.globalAlpha = 0.62 * appear;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * TAU);
    ctx.stroke();
  }

  if (pulse > 0) {
    ctx.globalAlpha = 0.35 * pulse * appear;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + (1 - pulse) * 18, 0, TAU);
    ctx.stroke();
  }

  // The loading marble.
  const inner = marbleR * (0.25 + 0.75 * progress) * appear;
  ctx.globalAlpha = (0.25 + 0.45 * progress) * appear;
  ctx.fillStyle = theme.foreground;
  ctx.beginPath();
  ctx.arc(x, y, inner, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function marbleColors(m: MarbleState, theme: ThemeColors) {
  if (m.degree === null) {
    return theme.dark
      ? { hi: "oklch(0.99 0 0)", mid: "oklch(0.86 0.01 260)", lo: "oklch(0.5 0.01 260)" }
      : { hi: "oklch(0.72 0.01 260)", mid: "oklch(0.42 0.01 260)", lo: "oklch(0.2 0.01 260)" };
  }
  return {
    hi: noteColor(m.degree, theme.dark, 1.4, 1, 0.5),
    mid: noteColor(m.degree, theme.dark, 0.1, 1, 0.9),
    lo: noteColor(m.degree, theme.dark, -2.2, 1, 0.9),
  };
}

/** A smooth comet tail: one tapered polygon with a fading gradient (no beading). */
function drawTrail(ctx: CanvasRenderingContext2D, m: MarbleState, x: number, y: number, theme: ThemeColors, alpha: number) {
  const pts = [...m.trail.slice(0, -1), { x, y }];
  const n = pts.length;
  const tail = pts[0];
  if (Math.hypot(x - tail.x, y - tail.y) < m.radius * 0.8) return;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const w = m.radius * 0.85 * Math.pow(i / (n - 1), 1.3);
    const px = (-(b.y - a.y) / len) * w;
    const py = ((b.x - a.x) / len) * w;
    left.push({ x: pts[i].x + px, y: pts[i].y + py });
    right.push({ x: pts[i].x - px, y: pts[i].y - py });
  }
  const strength = theme.dark ? 0.32 : 0.26;
  const color = (a: number) =>
    m.degree === null
      ? theme.dark
        ? `oklch(0.92 0 0 / ${a})`
        : `oklch(0.35 0 0 / ${a})`
      : noteColor(m.degree, theme.dark, 0.2, a);
  const grad = ctx.createLinearGradient(tail.x, tail.y, x, y);
  grad.addColorStop(0, color(0));
  grad.addColorStop(1, color(strength));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

export function drawMarble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  m: MarbleState,
  theme: ThemeColors,
  trails: boolean
) {
  const r = m.radius;
  const alpha = m.fade;
  const c = marbleColors(m, theme);
  ctx.save();

  if (trails && m.trail.length > 2) drawTrail(ctx, m, x, y, theme, alpha);

  if (!theme.dark) {
    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = theme.foreground;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y + r * 0.45, r * 0.95, r * 0.75, 0, 0, TAU);
    ctx.fill();
  }

  if (m.flash > 0.01 && m.degree !== null) {
    ctx.globalCompositeOperation = theme.dark ? "lighter" : "source-over";
    ctx.globalAlpha = alpha * m.flash * 0.5;
    ctx.fillStyle = noteColor(m.degree, theme.dark, 0.6, 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r * (1.5 + m.flash * 0.9), 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.05);
  grad.addColorStop(0, c.hi);
  grad.addColorStop(0.5, c.mid);
  grad.addColorStop(1, c.lo);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();

  // Specular glint.
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = "oklch(1 0 0)";
  ctx.beginPath();
  ctx.arc(x - r * 0.36, y - r * 0.4, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawEffects(ctx: CanvasRenderingContext2D, e: Effects, theme: ThemeColors) {
  ctx.save();
  ctx.globalCompositeOperation = theme.dark ? "lighter" : "source-over";
  for (const r of e.ripples) {
    const t = r.age / r.life;
    const ease = 1 - Math.pow(1 - t, 3);
    ctx.globalAlpha = (1 - t) * (theme.dark ? 0.55 : 0.5);
    ctx.strokeStyle = noteColor(r.degree, theme.dark, 0.4);
    ctx.lineWidth = 2.2 * (1 - t) + 0.4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 3 + r.radius * ease, 0, TAU);
    ctx.stroke();
  }
  for (const s of e.sparks) {
    const t = s.age / s.life;
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.fillStyle = noteColor(s.degree, theme.dark, 0.8);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * (1 - t * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
