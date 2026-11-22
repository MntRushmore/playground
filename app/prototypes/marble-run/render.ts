// Frame composition. Static plastic (columns + piece bodies, with soft studio shadows) is
// rendered into three cached layers and blitted each frame; moving parts, marbles and the
// editing overlay are drawn live on top, interleaved so marbles sit *inside* chutes and trays.

import { WORLD } from "./data";
import { handlePoint } from "./transforms";
import { column, foot, bandShade } from "./plastic";
import { FLOOR, POST_W, type Post } from "./posts";
import { drawMarble, drawSparks, drawTrails } from "./render-marbles";
import { drawParts } from "./render-parts";
import { drawStatic, type StaticLayer } from "./render-pieces";
import { tracePiece } from "./render-trace";
import { rgba, type BoardPalette } from "./theme";
import type { Ghost, Marble, Piece, PieceVisual, Spark, View } from "./types";

type Ctx = CanvasRenderingContext2D;

export const HANDLE_GAP_PX = 30;
export const HANDLE_R_PX = 15;

export type Layers = Record<StaticLayer, HTMLCanvasElement>;

export type Overlay = {
  selected: PieceVisual | null;
  rotating: number | null;
  ghost: Ghost | null;
  editing: boolean;
};

function worldTransform(ctx: Ctx, dpr: number, v: View) {
  ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, dpr * v.ox, dpr * v.oy);
}

function setShadow(ctx: Ctx, pal: BoardPalette, dpr: number, view: View, strength = 1) {
  const k = dpr * Math.max(0.5, view.scale);
  ctx.shadowColor = pal.dark ? `rgba(0,0,0,${0.55 * strength})` : `rgba(30,20,10,${0.26 * strength})`;
  ctx.shadowBlur = 14 * k * strength;
  ctx.shadowOffsetX = 5 * k * strength;
  ctx.shadowOffsetY = 9 * k * strength;
}

function clearShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawFloor(ctx: Ctx, pal: BoardPalette) {
  const g = ctx.createRadialGradient(WORLD.width / 2, FLOOR, 10, WORLD.width / 2, FLOOR, WORLD.width * 0.62);
  g.addColorStop(0, pal.dark ? "rgba(0,0,0,0.5)" : "rgba(40,30,20,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.translate(0, FLOOR);
  ctx.scale(1, 0.06);
  ctx.translate(0, -FLOOR);
  ctx.fillStyle = g;
  ctx.fillRect(-200, FLOOR - WORLD.width, WORLD.width + 400, WORLD.width * 2);
  ctx.restore();
}

export function drawPost(ctx: Ctx, p: Post) {
  column(ctx, p.x, p.top - 8, FLOOR - 30, POST_W, p.seed);
  foot(ctx, bandShade(p.seed + 2), p.x, FLOOR, 64);
}

/** Re-renders the cached static layers. Called when pieces, view, theme or size change. */
export function buildLayers(layers: Layers, dpr: number, view: View, pal: BoardPalette, pieces: readonly Piece[], posts: readonly Post[]) {
  for (const layer of ["body", "front", "lip"] as const) {
    const canvas = layers[layer];
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    worldTransform(ctx, dpr, view);
    if (layer === "body") {
      drawFloor(ctx, pal);
      setShadow(ctx, pal, dpr, view);
      for (const p of posts) drawPost(ctx, p);
    }
    for (const p of pieces) drawStatic(ctx, p, layer);
    clearShadow(ctx);
  }
}

function drawEditingGrid(ctx: Ctx, pal: BoardPalette, px: number) {
  ctx.save();
  ctx.setLineDash([6 * px, 6 * px]);
  ctx.strokeStyle = rgba(pal.fg, 0.16);
  ctx.lineWidth = px;
  ctx.beginPath();
  ctx.roundRect(0, 0, WORLD.width, WORLD.height, 16 * px);
  ctx.stroke();
  ctx.restore();
  const step = 50;
  const r = Math.max(1.1 * px, 1.8);
  ctx.fillStyle = rgba(pal.fg, pal.dark ? 0.1 : 0.12);
  ctx.beginPath();
  for (let x = step; x < WORLD.width; x += step) {
    for (let y = step; y < WORLD.height; y += step) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

function drawHandle(ctx: Ctx, pal: BoardPalette, piece: Piece, px: number, rotating: number | null) {
  const anchor = handlePoint(piece, 0);
  const h = handlePoint(piece, HANDLE_GAP_PX * px);
  const r = HANDLE_R_PX * px;
  ctx.strokeStyle = rgba(pal.fg, 0.55);
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(h.x, h.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(pal.bg);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.fg, 0.7);
  ctx.stroke();
  ctx.strokeStyle = rgba(pal.fg, 0.9);
  ctx.lineWidth = 1.6 * px;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(h.x, h.y, r * 0.48, -Math.PI * 0.15, Math.PI * 1.35);
  ctx.stroke();
  const tx = h.x + Math.cos(-Math.PI * 0.15) * r * 0.48;
  const ty = h.y + Math.sin(-Math.PI * 0.15) * r * 0.48;
  ctx.beginPath();
  ctx.moveTo(tx - 3.5 * px, ty - 2.5 * px);
  ctx.lineTo(tx + 0.5 * px, ty + 0.8 * px);
  ctx.lineTo(tx + 3.2 * px, ty - 3.4 * px);
  ctx.stroke();
  if (rotating !== null) {
    ctx.font = `500 ${12 * px}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = rgba(pal.fg, 0.9);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(rotating)}°`, h.x + r + 6 * px, h.y);
  }
}

function drawHalo(ctx: Ctx, pal: BoardPalette, v: PieceVisual, px: number) {
  ctx.save();
  ctx.setLineDash([5 * px, 4 * px]);
  ctx.strokeStyle = rgba(pal.fg, 0.55);
  ctx.fillStyle = rgba(pal.fg, pal.dark ? 0.07 : 0.05);
  ctx.lineWidth = 1.5 * px;
  tracePiece(ctx, v, 10 * px + 6);
  ctx.restore();
}

function drawGhost(ctx: Ctx, pal: BoardPalette, g: Ghost) {
  const v: PieceVisual = { piece: { id: "ghost", type: g.type, x: g.x, y: g.y, angle: g.angle, flip: false }, turn: 0, belt: 0, flash: 0 };
  ctx.save();
  ctx.globalAlpha = g.valid ? 0.75 : 0.3;
  drawStatic(ctx, v.piece, "body");
  drawParts(ctx, v);
  drawStatic(ctx, v.piece, "front");
  drawStatic(ctx, v.piece, "lip");
  ctx.restore();
}

export type FrameInput = {
  dpr: number;
  view: View;
  pal: BoardPalette;
  layers: Layers;
  visuals: readonly PieceVisual[];
  /** Piece being dragged: drawn live instead of from the cache. */
  live: PieceVisual | null;
  livePosts: readonly Post[];
  marbles: readonly Marble[];
  sparks: readonly Spark[];
  trails: boolean;
  overlay: Overlay;
};

export function drawFrame(ctx: Ctx, f: FrameInput) {
  const { dpr, view, pal, layers, live, overlay } = f;
  const blit = (c: HTMLCanvasElement) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(c, 0, 0);
    worldTransform(ctx, dpr, view);
  };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = rgba(pal.bg);
  ctx.fillRect(0, 0, view.width, view.height);
  worldTransform(ctx, dpr, view);
  const px = 1 / view.scale;

  if (overlay.editing) drawEditingGrid(ctx, pal, px);
  if (overlay.selected) drawHalo(ctx, pal, overlay.selected, px);
  blit(layers.body);
  if (live) {
    setShadow(ctx, pal, dpr, view);
    for (const p of f.livePosts) drawPost(ctx, p);
    drawStatic(ctx, live.piece, "body");
    clearShadow(ctx);
  }
  setShadow(ctx, pal, dpr, view, 0.6);
  for (const v of f.visuals) drawParts(ctx, v);
  clearShadow(ctx);
  for (const m of f.marbles) if (m.depth !== 0) drawMarble(ctx, pal, m);
  blit(layers.front);
  if (live) drawStatic(ctx, live.piece, "front");
  if (f.trails) drawTrails(ctx, f.marbles, pal.dark);
  for (const m of f.marbles) if (m.depth === 0) drawMarble(ctx, pal, m);
  blit(layers.lip);
  if (live) drawStatic(ctx, live.piece, "lip");
  drawSparks(ctx, pal, f.sparks);
  if (overlay.selected) drawHandle(ctx, pal, overlay.selected.piece, px, overlay.rotating);
  if (overlay.ghost) drawGhost(ctx, pal, overlay.ghost);
}
