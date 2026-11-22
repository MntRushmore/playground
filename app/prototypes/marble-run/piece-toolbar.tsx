"use client";

import { CopyIcon, FlipHorizontal2Icon, RotateCcwIcon, RotateCwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ANGLE_SNAP, MIRRORABLE, PIECE_LABELS, WORLD } from "./data";
import { worldBounds } from "./transforms";
import { worldToScreen } from "./board-layout";
import type { Piece, View } from "./types";

const BAR_H = 52;
const BAR_W_EST = 5 * 44 + 16;

type Props = {
  piece: Piece;
  view: View;
  onRotate: (delta: number) => void;
  onFlip: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/** Floating actions for the selected piece, placed above it (or below when there's no room). */
export function PieceToolbar({ piece, view, onRotate, onFlip, onDuplicate, onDelete }: Props) {
  const b = worldBounds(piece);
  const tl = worldToScreen(view, b.minX, b.minY);
  const br = worldToScreen(view, b.maxX, b.maxY);
  const mirror = MIRRORABLE.has(piece.type);
  const width = mirror ? BAR_W_EST : BAR_W_EST - 44;
  const cx = (tl.x + br.x) / 2;
  const left = Math.min(Math.max(8, cx - width / 2), Math.max(8, view.width - width - 8));
  // Leave room for the rotate handle above the piece.
  const above = tl.y - BAR_H - 58;
  const boardBottom = view.oy + view.scale * WORLD.height;
  const top = above >= 8 ? above : Math.min(br.y + 14, boardBottom - BAR_H);

  return (
    <div
      key={piece.id}
      role="toolbar"
      aria-label={`${PIECE_LABELS[piece.type]} actions`}
      style={{ left, top: Math.max(8, top) }}
      className="absolute z-10 flex animate-in gap-0.5 rounded-2xl border border-border bg-background/85 p-1 shadow-lg backdrop-blur-md duration-200 ease-(--ease-out-quint) fade-in-0 zoom-in-95"
    >
      <Button variant="ghost" className="size-11 rounded-xl" aria-label={`Rotate left ${ANGLE_SNAP}°`} onClick={() => onRotate(-ANGLE_SNAP)}>
        <RotateCcwIcon />
      </Button>
      <Button variant="ghost" className="size-11 rounded-xl" aria-label={`Rotate right ${ANGLE_SNAP}°`} onClick={() => onRotate(ANGLE_SNAP)}>
        <RotateCwIcon />
      </Button>
      {mirror && (
        <Button variant="ghost" className="size-11 rounded-xl" aria-label="Mirror" onClick={onFlip}>
          <FlipHorizontal2Icon />
        </Button>
      )}
      <Button variant="ghost" className="size-11 rounded-xl" aria-label="Duplicate" onClick={onDuplicate}>
        <CopyIcon />
      </Button>
      <Button variant="ghost" className="size-11 rounded-xl text-destructive hover:text-destructive" aria-label="Delete" onClick={onDelete}>
        <Trash2Icon />
      </Button>
    </div>
  );
}
