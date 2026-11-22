"use client";

import { FlameIcon, LightbulbIcon, LightbulbOffIcon } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { TOOL_BUTTON } from "./carve-toolbar";

type Props = {
  lit: boolean;
  onLit: (lit: boolean) => void;
  dark: boolean;
  onDark: (dark: boolean) => void;
};

/** Candle and room lights. Bottom-left on phones (the controls button is bottom-right). */
export function SceneToggles({ lit, onLit, dark, onDark }: Props) {
  return (
    <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-10 flex gap-1 rounded-2xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-md md:left-1/2 md:-translate-x-1/2">
      <Toggle pressed={lit} onPressedChange={onLit} aria-label="Candle" className={TOOL_BUTTON}>
        <FlameIcon />
        <span className="hidden sm:inline">Candle</span>
      </Toggle>
      <Toggle pressed={dark} onPressedChange={onDark} aria-label="Lights off" className={TOOL_BUTTON}>
        {dark ? <LightbulbOffIcon /> : <LightbulbIcon />}
        <span className="hidden sm:inline">Lights off</span>
      </Toggle>
    </div>
  );
}
