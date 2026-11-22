// Moving parts, redrawn every frame: spinner wheels, flipper trays, spring pads, bumpers,
// lift cleats and sprockets, cup glow. World units, light from the top-left.

import { CUP_SENSOR, LIFT, SWITCH, WHEEL, cleatPose } from "./geometry";
import { rad } from "./transforms";
import { bar, ellipseGloss, pieceShade, shade } from "./plastic";
import { rgba } from "./theme";
import type { PieceVisual } from "./types";

type Ctx = CanvasRenderingContext2D;

function hub(ctx: Ctx, r: number, name: "blue" | "yellow" | "steel") {
  const s = shade(name);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, rgba(s.spec));
  g.addColorStop(0.5, rgba(s.base));
  g.addColorStop(1, rgba(s.deep));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawWheel(ctx: Ctx, v: PieceVisual) {
  const s = pieceShade(v.piece);
  ctx.save();
  ctx.rotate(v.turn);
  const len = WHEEL.reach;
  for (let i = 0; i < WHEEL.paddles; i++) {
    const a = (i / WHEEL.paddles) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    bar(ctx, s, c * 10, sn * 10, c * (len - 6), sn * (len - 6), 10);
    // Paddle blade at the tip.
    ctx.save();
    ctx.translate(c * (len - 10), sn * (len - 10));
    ctx.rotate(a);
    bar(ctx, s, 0, -9, 0, 9, 9);
    ctx.restore();
  }
  ctx.restore();
  hub(ctx, 20, "blue");
  hub(ctx, 7, "steel");
}

function drawSwitch(ctx: Ctx, v: PieceVisual) {
  const s = pieceShade(v.piece);
  ctx.save();
  ctx.rotate(v.turn);
  const h = SWITCH.length / 2;
  bar(ctx, s, -h + 6, 0, h - 6, 0, 14);
  // Raised tray ends.
  bar(ctx, s, -h + 4, -4, -h + 4, -11, 7);
  bar(ctx, s, h - 4, -4, h - 4, -11, 7);
  ctx.restore();
  hub(ctx, 10, "yellow");
}

function coil(ctx: Ctx, y0: number, y1: number) {
  ctx.beginPath();
  const turns = 5;
  for (let i = 0; i <= turns * 2; i++) {
    const t = i / (turns * 2);
    const x = i === 0 || i === turns * 2 ? 0 : i % 2 ? -21 : 21;
    if (i === 0) ctx.moveTo(x, y0);
    else ctx.lineTo(x, y0 + (y1 - y0) * t);
  }
  const s = shade("steel");
  ctx.strokeStyle = rgba(s.dark);
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.strokeStyle = rgba(s.spec, 0.8);
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawSpring(ctx: Ctx, v: PieceVisual) {
  const squash = v.flash * 8;
  coil(ctx, -10 + squash, 20);
  bar(ctx, pieceShade(v.piece), -40, -16 + squash, 40, -16 + squash, 13);
}

function drawBumper(ctx: Ctx, v: PieceVisual) {
  const r = 28 * (1 + v.flash * 0.07);
  if (v.flash > 0.02) {
    ctx.beginPath();
    ctx.arc(0, 0, r + 5 + (1 - v.flash) * 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * v.flash})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const s = pieceShade(v.piece);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, rgba(s.spec));
  g.addColorStop(0.45, rgba(s.light));
  g.addColorStop(0.8, rgba(s.base));
  g.addColorStop(1, rgba(s.deep));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ellipseGloss(ctx, shade("yellow"), 0, 0, r * 0.5, r * 0.5);
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
}

function drawLiftParts(ctx: Ctx, v: PieceVisual) {
  const m = v.piece.flip ? -1 : 1;
  const half = LIFT.height / 2;
  const s = shade("yellow");
  const steel = shade("steel");
  // Chain run behind the cleats.
  // Chain: a steel strap with links that travel with the belt.
  const x = LIFT.cleatX * m;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(steel.deep, 0.75);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, half + 30);
  ctx.lineTo(x, -half + 10);
  ctx.stroke();
  ctx.setLineDash([0.1, 11]);
  ctx.lineDashOffset = v.belt % 11.1;
  ctx.strokeStyle = rgba(steel.spec, 0.9);
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.restore();
  for (const y of [-half + 10, half + 30]) {
    ctx.save();
    ctx.translate(LIFT.cleatX * m, y);
    ctx.rotate((v.belt / 16) * m);
    hub(ctx, 16, "steel");
    ctx.strokeStyle = rgba(steel.deep, 0.8);
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(13, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (let i = 0; i < LIFT.cleats; i++) {
    const pose = cleatPose((v.belt + (i * LIFT.cycle) / LIFT.cleats) % LIFT.cycle);
    if (!pose) continue;
    const c = Math.cos(pose.a * m) * (LIFT.cleatW / 2 - 5);
    const sn = Math.sin(pose.a * m) * (LIFT.cleatW / 2 - 5);
    const x = pose.x * m;
    bar(ctx, s, x - c, pose.y - sn, x + c, pose.y + sn, 11);
  }
}

function drawCupGlow(ctx: Ctx, v: PieceVisual) {
  if (v.flash < 0.02) return;
  const g = ctx.createRadialGradient(0, CUP_SENSOR.y - 20, 4, 0, CUP_SENSOR.y - 20, 110);
  g.addColorStop(0, `rgba(255,255,255,${0.35 * v.flash})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-110, -140, 220, 220);
}

export function drawParts(ctx: Ctx, v: PieceVisual) {
  const p = v.piece;
  if (!["wheel", "switch", "spring", "bumper", "lift", "cup"].includes(p.type)) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rad(p.angle));
  if (p.type === "wheel") drawWheel(ctx, v);
  else if (p.type === "switch") drawSwitch(ctx, v);
  else if (p.type === "spring") drawSpring(ctx, v);
  else if (p.type === "bumper") drawBumper(ctx, v);
  else if (p.type === "lift") drawLiftParts(ctx, v);
  else drawCupGlow(ctx, v);
  ctx.restore();
}
