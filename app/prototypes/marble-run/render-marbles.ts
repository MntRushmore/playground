// Glass marbles: soft shadow, radial body, a vane that turns with the marble's real spin
// (so rolling reads instantly), and a fixed specular highlight. World units.

import { FADE_MS, MARBLE_COLORS } from "./data";
import { hexToRgb, mix, rgba, type BoardPalette } from "./theme";
import type { Marble, Rgb, Spark } from "./types";

type Ctx = CanvasRenderingContext2D;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

const PALETTE = MARBLE_COLORS.map(([body, vane]) => {
  const base = hexToRgb(body);
  return {
    base,
    vane: hexToRgb(vane),
    light: mix(base, WHITE, 0.5),
    dark: mix(base, BLACK, 0.38),
  };
});

export function marbleRgb(color: number) {
  return PALETTE[color % PALETTE.length].base;
}

function presence(m: Marble) {
  const appear = Math.min(1, m.age / 180);
  const grow = 1 - Math.pow(1 - appear, 3);
  if (m.dying < 0) return { alpha: 1, scale: grow };
  const t = Math.min(1, m.dying / FADE_MS);
  return { alpha: 1 - t, scale: grow * (1 - 0.35 * t) };
}

export function drawTrails(ctx: Ctx, marbles: readonly Marble[], dark: boolean) {
  ctx.lineCap = "round";
  for (const m of marbles) {
    const t = m.trail;
    if (t.length < 3 || m.depth !== 0) continue;
    const head = t[t.length - 1];
    const tail = t[0];
    if (Math.hypot(head.x - tail.x, head.y - tail.y) < m.radius * 2.2) continue;
    const c = marbleRgb(m.color);
    const { alpha } = presence(m);
    for (let i = 1; i < t.length; i++) {
      const k = i / t.length;
      ctx.strokeStyle = rgba(c, (dark ? 0.22 : 0.26) * k * k * alpha);
      ctx.lineWidth = m.radius * 1.5 * k;
      ctx.beginPath();
      ctx.moveTo(t[i - 1].x, t[i - 1].y);
      ctx.lineTo(i === t.length - 1 ? m.x : t[i].x, i === t.length - 1 ? m.y : t[i].y);
      ctx.stroke();
    }
  }
}

export function drawMarble(ctx: Ctx, pal: BoardPalette, m: Marble) {
  const { alpha, scale } = presence(m);
  if (scale <= 0.01) return;
  // Orbiting marbles shrink and dim slightly behind the funnel cone.
  const depthScale = 1 - 0.14 * m.depth;
  const r = m.radius * scale * depthScale;
  const c = PALETTE[m.color % PALETTE.length];
  const { x, y } = m;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Contact shadow on the pegboard behind.
  const sh = ctx.createRadialGradient(x + r * 0.22, y + r * 0.42, r * 0.2, x + r * 0.22, y + r * 0.42, r * 1.3);
  sh.addColorStop(0, pal.dark ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.16)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(x + r * 0.22, y + r * 0.42, r * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Glass body.
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  g.addColorStop(0, rgba(c.light));
  g.addColorStop(0.55, rgba(c.base));
  g.addColorStop(1, rgba(c.dark));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // Twisted vane inside the glass: rotates with the body, so spin is visible.
  ctx.save();
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(m.angle);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.bezierCurveTo(-r * 0.35, -r * 0.62, r * 0.35, r * 0.62, r, 0);
  ctx.bezierCurveTo(r * 0.3, r * 0.2, -r * 0.3, -r * 0.2, -r, 0);
  ctx.fillStyle = rgba(c.vane, 0.78);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = rgba(c.dark, 0.5);
  ctx.fill();
  ctx.restore();

  // Rim darkening for depth, then the fixed highlight.
  const rim = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.36, y - r * 0.42, r * 0.3, r * 0.17, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0.25, 1.3);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = "round";
  ctx.stroke();
  if (m.depth > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.bg, 0.28 * m.depth);
    ctx.fill();
  }
  ctx.restore();
}

export function drawSparks(ctx: Ctx, pal: BoardPalette, sparks: readonly Spark[]) {
  for (const s of sparks) {
    const c = s.color < 0 ? pal.fg : marbleRgb(s.color);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2 + 3 * s.life, 0, Math.PI * 2);
    ctx.fillStyle = rgba(c, 0.85 * s.life);
    ctx.fill();
  }
}
