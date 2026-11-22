"use client";

import { Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Floating pill shared by the sound prompt and the toolbar, so one hands off to the other. */
export const FLOATING_BAR =
  "absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 flex gap-0.5 rounded-full border border-border bg-background/80 p-0.5 shadow-sm backdrop-blur-md transition-[opacity,translate] duration-300 ease-(--ease-out-quint)";

/**
 * Minimal start affordance: browsers need a gesture before audio can play. Until then
 * the machine runs silently; any tap on the canvas also starts sound.
 */
export function SoundPrompt({ visible, onStart }: { visible: boolean; onStart: () => void }) {
  return (
    <div
      inert={!visible}
      className={cn(FLOATING_BAR, visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}
    >
      <Button variant="ghost" onClick={onStart} className="h-11 rounded-full px-4 active:bg-muted">
        <Volume2Icon />
        Tap for sound
      </Button>
    </div>
  );
}
