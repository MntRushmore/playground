"use client";

import { PauseIcon, PlayIcon, RefreshCcwIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  running: boolean;
  canUndo: boolean;
  onToggle: () => void;
  onResetMarbles: () => void;
  onUndo: () => void;
};

export function RunControls({ running, canUndo, onToggle, onResetMarbles, onUndo }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button
        className="h-12 min-w-12 rounded-full px-3.5 text-sm sm:px-5 @min-[720px]:flex-1"
        onClick={onToggle}
        aria-label={running ? "Pause" : "Play"}
      >
        {running ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
        <span className="hidden sm:inline">{running ? "Pause" : "Play"}</span>
      </Button>
      <Button variant="ghost" className="size-11 rounded-full" onClick={onResetMarbles} aria-label="Reset marbles">
        <RefreshCcwIcon className="size-[18px]" />
      </Button>
      <Button variant="ghost" className="size-11 rounded-full" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
        <Undo2Icon className="size-[18px]" />
      </Button>
    </div>
  );
}
