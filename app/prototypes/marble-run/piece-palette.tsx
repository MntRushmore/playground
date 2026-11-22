"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { PIECE_LABELS, PIECE_TYPES } from "./data";
import { PieceIcon } from "./piece-icon";
import type { PieceType } from "./types";

type Props = {
  armed: PieceType | null;
  onArm: (type: PieceType | null) => void;
  /** Dragging a piece out of the tray: preview at a client point; returns the drop point if valid. */
  onDragPreview: (type: PieceType | null, clientX: number, clientY: number) => { x: number; y: number } | null;
  onDrop: (type: PieceType, x: number, y: number) => void;
};

/** Tap a piece to arm it (then tap the board), or drag it straight onto the board. */
export function PiecePalette({ armed, onArm, onDragPreview, onDrop }: Props) {
  const drag = useRef<{ type: PieceType; id: number; x: number; y: number; active: boolean } | null>(null);
  /** Swallows the click that follows a drag-out. */
  const dragged = useRef(false);

  const down = (type: PieceType) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary || e.button > 0) return;
    dragged.current = false;
    drag.current = { type, id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  };

  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.active) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      // Mostly-vertical (or any mouse) movement pulls the piece out; horizontal swipes scroll the tray.
      const pull = e.pointerType === "mouse" ? Math.hypot(dx, dy) > 6 : Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx);
      if (!pull) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    onDragPreview(d.type, e.clientX, e.clientY);
  };

  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.active) return;
    dragged.current = true;
    const pos = onDragPreview(d.type, e.clientX, e.clientY);
    onDragPreview(null, 0, 0);
    if (pos) onDrop(d.type, pos.x, pos.y);
  };

  const cancel = () => {
    if (drag.current?.active) onDragPreview(null, 0, 0);
    drag.current = null;
  };

  return (
    <div
      role="toolbar"
      aria-label="Pieces"
      className="flex touch-pan-x gap-0.5 overflow-x-auto overscroll-contain [scrollbar-width:none] @min-[720px]:touch-pan-y @min-[720px]:flex-col @min-[720px]:overflow-x-visible @min-[720px]:overflow-y-auto [&::-webkit-scrollbar]:hidden"
    >
      {PIECE_TYPES.map((type) => {
        const on = armed === type;
        return (
          <button
            key={type}
            type="button"
            aria-label={PIECE_LABELS[type]}
            aria-pressed={on}
            onClick={() => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              onArm(on ? null : type);
            }}
            onPointerDown={down(type)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={cancel}
            className={cn(
              "flex h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-muted-foreground transition-colors duration-200 ease-(--ease-out-quint) outline-none select-none",
              "hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted",
              "sm:h-14 sm:w-16",
              "@min-[720px]:h-10 @min-[720px]:w-full @min-[720px]:flex-row @min-[720px]:justify-start @min-[720px]:gap-2.5 @min-[720px]:px-2.5",
              on && "bg-foreground text-background hover:bg-foreground hover:text-background active:bg-foreground"
            )}
          >
            <PieceIcon type={type} className="size-5 shrink-0" />
            <span className="hidden text-[10px] leading-none font-medium sm:block @min-[720px]:text-[13px]">
              {PIECE_LABELS[type]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
