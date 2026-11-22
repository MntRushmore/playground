"use client";

import { Equal, Flag, RotateCcw, Shuffle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Snapshot } from "./engine";
import { teamSwatch } from "./palette";

export function ResultBanner({
  snap,
  onReset,
  onRandomize,
}: {
  snap: Snapshot;
  onReset: () => void;
  onRandomize: () => void;
}) {
  const { winner, mode } = snap;
  const draw = winner === "draw";

  let title: string;
  let Icon = Trophy;
  if (draw) {
    title = "Stalemate";
    Icon = Equal;
  } else if (mode === "cpu") {
    const win = winner === "blue";
    title = win ? "Victory!" : "Defeat";
    Icon = win ? Trophy : Flag;
  } else {
    title = winner === "blue" ? "Blue wins!" : "Red wins!";
  }

  const accent = !draw && winner ? teamSwatch(winner) : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/95 px-7 py-6 text-center shadow-lg backdrop-blur-sm duration-300 animate-in fade-in zoom-in-95">
        <div
          className="flex size-12 items-center justify-center rounded-full bg-muted"
          style={accent ? { color: accent } : undefined}
        >
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {draw ? "Time ran out — even match." : "The ink has settled."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onReset} className="h-11 px-4">
            <RotateCcw />
            Redraw
          </Button>
          <Button variant="secondary" onClick={onRandomize} className="h-11 px-4">
            <Shuffle />
            New armies
          </Button>
        </div>
      </div>
    </div>
  );
}
