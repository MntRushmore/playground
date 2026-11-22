// Selection outline: a rounded box (or circle) around the piece's hit area.

import { hitShape } from "./geometry";
import { rad } from "./transforms";
import type { PieceVisual } from "./types";

export function tracePiece(ctx: CanvasRenderingContext2D, v: PieceVisual, pad: number) {
  const p = v.piece;
  const h = hitShape(p.type);
  const cx = p.flip ? -h.cx : h.cx;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(rad(p.angle));
  ctx.beginPath();
  if (h.round) ctx.arc(cx, h.cy, h.hw + pad, 0, Math.PI * 2);
  else {
    const w = (h.hw + pad) * 2;
    const hh = (h.hh + pad) * 2;
    ctx.roundRect(cx - w / 2, h.cy - hh / 2, w, hh, Math.min(hh / 2, 22));
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
