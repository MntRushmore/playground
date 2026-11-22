"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/** Track-level actions, shown under the control panel. Both are undoable. */
export function TrackActions({ onRestore, onClear }: { onRestore: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <Separator />
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={onRestore}>
          Default run
        </Button>
        <Button variant="ghost" className="h-11 flex-1 text-muted-foreground" onClick={onClear}>
          Clear track
        </Button>
      </div>
    </div>
  );
}
