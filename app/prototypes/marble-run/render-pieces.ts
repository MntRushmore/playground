// Static plastic pieces, drawn into cached layers (the context is world-transformed):
//   "body"  under marbles (shadows on)       "front" funnel walls over orbiting marbles
//   "lip"   translucent front lips of chutes and trays, drawn over marbles

import { TRACK } from "./data";
import { CUP_SENSOR, FUNNEL, LIFT, RAMP_LENGTH, curveArc, localPrims } from "./geometry";
import { mirrorPrim, rad } from "./transforms";
import { arcBand, bar, column, ellipseGloss, glint, pieceShade, shade, tube, type Shade } from "./plastic";
import { rgba } from "./theme";
import type { Piece, Prim } from "./types";

type Ctx = CanvasRenderingContext2D;
export type StaticLayer = "body" | "front" | "lip";

const LIP = 9;

/** Centre line of a rect prim along its long axis, plus its thickness. */
function rectEnds(p: Prim & { k: "rect" }) {
  const long = Math.max(p.w, p.h);
  const thick = Math.min(p.w, p.h);
  const a = p.w >= p.h ? p.a : p.a + Math.PI / 2;
  const c = Math.cos(a) * (long / 2 - thick / 2);
  const s = Math.sin(a) * (long / 2 - thick / 2);
  return { x0: p.x - c, y0: p.y - s, x1: p.x + c, y1: p.y + s, thick };
}

function drawChute(ctx: Ctx, s: Shade, x0: number, y0: number, x1: number, y1: number, layer: StaticLayer) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  // Offset toward the rail's top (rolling) side.
  const ox = Math.sin(a) * (TRACK / 2);
  const oy = -Math.cos(a) * (TRACK / 2);
  if (layer === "body") {
    bar(ctx, s, x0 - ox * 0.2, y0 - oy * 0.2, x1 - ox * 0.2, y1 - oy * 0.2, TRACK + 4);
  } else if (layer === "lip") {
    // Near wall of the trough: translucent, over the lower part of a rolling marble.
    bar(ctx, s, x0 + ox * 1.25, y0 + oy * 1.25, x1 + ox * 1.25, y1 + oy * 1.25, LIP, 0.5);
    const k = 0.42;
    glint(ctx, x0 + ox * 1.75, y0 + oy * 1.75, x0 + (x1 - x0) * k + ox * 1.75, y0 + (y1 - y0) * k + oy * 1.75, 1.6, 0.6);
  }
}

function drawCurve(ctx: Ctx, p: Piece, s: Shade, layer: StaticLayer) {
  const c = curveArc();
  const cx = p.flip ? -c.cx : c.cx;
  const [a0, a1] = p.flip ? [Math.PI - c.a1, Math.PI - c.a0] : [c.a0, c.a1];
  if (layer === "body") {
    arcBand(ctx, s, cx, c.cy, c.r + 1.5, a0, a1, TRACK + 4);
  } else if (layer === "lip") {
    arcBand(ctx, s, cx, c.cy, c.r - TRACK * 0.62, a0, a1, LIP, 0.5);
  }
}

function drawFunnel(ctx: Ctx, s: Shade, layer: StaticLayer) {
  const { rim, rimY, neck, neckY, spout, tilt } = FUNNEL;
  const ry = rim * tilt;
  const silhouette = (front: boolean) => {
    ctx.beginPath();
    ctx.moveTo(-rim, rimY);
    if (front) ctx.ellipse(0, rimY, rim, ry, 0, Math.PI, 0, true);
    else ctx.ellipse(0, rimY, rim, ry, 0, Math.PI, 0, false);
    ctx.lineTo(neck + 6, neckY);
    ctx.lineTo(-neck - 6, neckY);
    ctx.closePath();
  };
  if (layer === "body") {
    tube(ctx, s, 0, neckY - 6, neckY + spout + 4, neck * 2 + 12);
    // Inside of the dish (seen through the open top): shaded under the far rim, lit on the
    // near slope, dark at the hole.
    silhouette(false);
    const g = ctx.createLinearGradient(0, rimY - ry, 0, neckY);
    g.addColorStop(0, rgba(s.deep));
    g.addColorStop(0.3, rgba(s.dark));
    g.addColorStop(0.62, rgba(s.base));
    g.addColorStop(1, rgba(s.deep));
    ctx.fillStyle = g;
    ctx.fill();
    // Soft sheen across the inner slope.
    ctx.save();
    ctx.clip();
    const sheen = ctx.createRadialGradient(-rim * 0.35, rimY + ry * 0.4, 4, -rim * 0.35, rimY + ry * 0.4, rim * 0.7);
    sheen.addColorStop(0, rgba(s.spec, 0.45));
    sheen.addColorStop(1, rgba(s.spec, 0));
    ctx.fillStyle = sheen;
    ctx.fillRect(-rim, rimY - ry, rim * 2, neckY - rimY + ry);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, neckY - 4, neck + 2, (neck + 2) * tilt * 1.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
  } else if (layer === "front") {
    // Front outer wall: translucent plastic, so marbles circling in front still read.
    silhouette(true);
    const g = ctx.createLinearGradient(-rim, 0, rim, 0);
    g.addColorStop(0, rgba(s.light, 0.7));
    g.addColorStop(0.22, rgba(s.spec, 0.62));
    g.addColorStop(0.45, rgba(s.base, 0.55));
    g.addColorStop(1, rgba(s.deep, 0.75));
    ctx.fillStyle = g;
    ctx.fill();
    // Rolled rim.
    ctx.beginPath();
    ctx.ellipse(0, rimY, rim, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(s.dark);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, rimY - 1.5, rim, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = rgba(s.spec, 0.9);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, rimY + 1, rim, ry, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = rgba(s.light, 0.9);
    ctx.lineWidth = 3;
    ctx.stroke();
    glint(ctx, -rim * 0.72, rimY + 14, -neck - 18, neckY - 14, 2.5, 0.28);
  }
}

function drawCup(ctx: Ctx, s: Shade, layer: StaticLayer) {
  if (layer === "body") {
    // Inside of the tray: back wall in shade, lighter towards the floor.
    const g = ctx.createLinearGradient(0, -46, 0, 46);
    g.addColorStop(0, rgba(s.dark));
    g.addColorStop(1, rgba(s.base));
    ctx.beginPath();
    ctx.moveTo(-66, -44);
    ctx.lineTo(66, -44);
    ctx.lineTo(60, 44);
    ctx.lineTo(-60, 44);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    for (const pr of localPrims("cup")) {
      if (pr.k !== "rect") continue;
      const e = rectEnds(pr);
      bar(ctx, s, e.x0, e.y0, e.x1, e.y1, e.thick + 2);
    }
  } else if (layer === "lip") {
    // Front face of the catch tray, over the lower half of resting marbles.
    const g = ctx.createLinearGradient(-74, 0, 74, 0);
    g.addColorStop(0, rgba(s.light, 0.97));
    g.addColorStop(0.18, rgba(s.spec, 0.97));
    g.addColorStop(0.4, rgba(s.base, 0.97));
    g.addColorStop(1, rgba(s.deep, 0.97));
    ctx.beginPath();
    ctx.moveTo(-71, 24);
    ctx.lineTo(71, 24);
    ctx.lineTo(70, 46);
    ctx.quadraticCurveTo(68, 56, 56, 56);
    ctx.lineTo(-56, 56);
    ctx.quadraticCurveTo(-68, 56, -70, 46);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    glint(ctx, -58, 28, 40, 28, 2.2, 0.7);
  }
  void CUP_SENSOR;
}

function drawDropper(ctx: Ctx, s: Shade, layer: StaticLayer) {
  if (layer !== "body") return;
  tube(ctx, shade("green"), 0, -12, 36, 30);
  const g = ctx.createLinearGradient(-36, 0, 36, 0);
  g.addColorStop(0, rgba(s.light));
  g.addColorStop(0.2, rgba(s.spec));
  g.addColorStop(0.45, rgba(s.base));
  g.addColorStop(1, rgba(s.deep));
  ctx.beginPath();
  ctx.moveTo(-36, -42);
  ctx.lineTo(36, -42);
  ctx.quadraticCurveTo(20, -24, 16, -6);
  ctx.lineTo(-16, -6);
  ctx.quadraticCurveTo(-20, -24, -36, -42);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ellipseGloss(ctx, s, 0, -42, 36, 9);
  ctx.beginPath();
  ctx.ellipse(0, -41, 28, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgba(s.deep);
  ctx.fill();
}

function drawLiftFrame(ctx: Ctx, p: Piece, s: Shade, layer: StaticLayer) {
  const m = p.flip ? -1 : 1;
  const half = LIFT.height / 2;
  const top = -half - 64;
  if (layer === "body") {
    column(ctx, 46 * m, top, half + 30, 28, 1, 64);
    column(ctx, -46 * m, -half + 96, half + 30, 24, 3, 64);
  }
  for (const pr of localPrims("lift").map((x) => mirrorPrim(x, p.flip))) {
    if (pr.k !== "rect" || pr.tag === "rail") continue;
    const e = rectEnds(pr);
    if (Math.max(pr.w, pr.h) > 60) drawChute(ctx, s, e.x0, e.y0, e.x1, e.y1, layer);
    else if (layer === "body") bar(ctx, s, e.x0, e.y0, e.x1, e.y1, e.thick + 1);
  }
}

export function drawStatic(ctx: Ctx, p: Piece, layer: StaticLayer) {
  const s = pieceShade(p);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rad(p.angle));
  switch (p.type) {
    case "ramp":
      drawChute(ctx, s, -RAMP_LENGTH / 2 + TRACK / 2, 0, RAMP_LENGTH / 2 - TRACK / 2, 0, layer);
      break;
    case "curve":
      drawCurve(ctx, p, s, layer);
      break;
    case "funnel":
      drawFunnel(ctx, s, layer);
      break;
    case "cup":
      drawCup(ctx, s, layer);
      break;
    case "dropper":
      drawDropper(ctx, s, layer);
      break;
    case "lift":
      drawLiftFrame(ctx, p, s, layer);
      break;
    case "spring":
      if (layer === "body") bar(ctx, shade("red"), -28, 24, 28, 24, 11);
      break;
  }
  ctx.restore();
}
