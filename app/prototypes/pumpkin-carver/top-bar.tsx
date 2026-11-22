"use client";

import { BandageIcon, BrushIcon, FlameIcon, LightbulbIcon, LightbulbOffIcon, SliceIcon } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Tool } from "./types";

const TOOLS = [
  { id: "carve", label: "Carve", Icon: SliceIcon },
  { id: "etch", label: "Etch", Icon: BrushIcon },
  { id: "patch", label: "Patch", Icon: BandageIcon },
] as const;

const PILL = "rounded-full border border-border bg-background/75 shadow-sm backdrop-blur-md";
const ON = "data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground";

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
  lit: boolean;
  onLit: (lit: boolean) => void;
  dark: boolean;
  onDark: (dark: boolean) => void;
};

/** Candle — tool segmented control — room lights. */
export function TopBar({ tool, onTool, lit, onLit, dark, onDark }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 pt-3">
      <Toggle
        pressed={lit}
        onPressedChange={onLit}
        aria-label="Candle"
        className={`pointer-events-auto size-11 ${PILL} ${ON}`}
      >
        <FlameIcon />
      </Toggle>
      <ToggleGroup
        type="single"
        spacing={0}
        value={tool}
        onValueChange={(v) => v && onTool(v as Tool)}
        aria-label="Tool"
        className={`pointer-events-auto gap-0.5 p-0.5 ${PILL}`}
      >
        {TOOLS.map(({ id, label, Icon }) => (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={label}
            className={`h-11 gap-1.5 rounded-full! px-3 ${ON}`}
          >
            <Icon />
            <span>{label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Toggle
        pressed={dark}
        onPressedChange={onDark}
        aria-label="Lights off"
        className={`pointer-events-auto size-11 ${PILL} ${ON}`}
      >
        {dark ? <LightbulbOffIcon /> : <LightbulbIcon />}
      </Toggle>
    </div>
  );
}
