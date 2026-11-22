"use client";

import { DicesIcon, PauseIcon, PlayIcon, PlusIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FLOATING_BAR } from "./sound-prompt";
import type { SoundState } from "./use-marble-audio";

/**
 * Floating toolbar over the canvas: icon-only on phones (including landscape, where a
 * labelled bar would cover the machine), labelled on wider and taller screens.
 */
export function MachineToolbar({
  visible,
  emitting,
  sound,
  onToggleEmitting,
  onAddBar,
  onNewLayout,
  onToggleSound,
}: {
  visible: boolean;
  emitting: boolean;
  sound: SoundState;
  onToggleEmitting: () => void;
  onAddBar: () => void;
  onNewLayout: () => void;
  onToggleSound: () => void;
}) {
  const soundOn = sound === "on";
  const items = [
    {
      label: emitting ? "Pause" : "Play",
      aria: emitting ? "Pause drops" : "Resume drops",
      icon: emitting ? <PauseIcon /> : <PlayIcon />,
      onClick: onToggleEmitting,
    },
    { label: "Add bar", aria: "Add bar", icon: <PlusIcon />, onClick: onAddBar },
    { label: "New layout", aria: "New layout", icon: <DicesIcon />, onClick: onNewLayout },
    {
      label: soundOn ? "Sound" : "Muted",
      aria: soundOn ? "Mute" : "Turn sound on",
      icon: soundOn ? <Volume2Icon /> : <VolumeXIcon />,
      onClick: onToggleSound,
    },
  ];

  return (
    <div
      inert={!visible}
      className={cn(FLOATING_BAR, visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}
    >
      {items.map((item) => (
        <Button
          key={item.aria}
          variant="ghost"
          onClick={item.onClick}
          aria-label={item.aria}
          className="size-11 rounded-full active:bg-muted sm:[@media(min-height:30rem)]:w-auto sm:[@media(min-height:30rem)]:px-3.5"
        >
          {item.icon}
          <span className="hidden sm:[@media(min-height:30rem)]:inline">{item.label}</span>
        </Button>
      ))}
    </div>
  );
}
