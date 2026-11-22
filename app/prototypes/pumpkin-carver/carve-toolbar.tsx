"use client";

import {
  BrushIcon,
  CheckIcon,
  DownloadIcon,
  FlipHorizontal2Icon,
  SliceIcon,
  StampIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { Collapse } from "@/components/motion/collapse";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StampPicker } from "./stamp-picker";
import type { StampId, Tool } from "./types";

const TOOLS = [
  { id: "knife", label: "Knife", Icon: SliceIcon },
  { id: "etch", label: "Etch", Icon: BrushIcon },
  { id: "stamp", label: "Stamp", Icon: StampIcon },
] as const;

/** 44px targets, icon-only on phones, labelled from sm. */
export const TOOL_BUTTON =
  "h-11 min-w-11 gap-1.5 rounded-xl px-0 sm:px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
  stamp: StampId;
  onStamp: (stamp: StampId) => void;
  mirror: boolean;
  onMirror: (on: boolean) => void;
  canUndo: boolean;
  canClear: boolean;
  onUndo: () => void;
  onClear: () => void;
  onSave: () => void;
  saved: boolean;
};

export function CarveToolbar(p: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center px-2 pt-2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-md">
        <ToggleGroup
          type="single"
          spacing={1}
          value={p.tool}
          onValueChange={(v) => v && p.onTool(v as Tool)}
          aria-label="Tool"
        >
          {TOOLS.map(({ id, label, Icon }) => (
            <ToggleGroupItem key={id} value={id} aria-label={label} className={TOOL_BUTTON}>
              <Icon />
              <span className="hidden sm:inline">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Toggle pressed={p.mirror} onPressedChange={p.onMirror} aria-label="Mirror" className={TOOL_BUTTON}>
          <FlipHorizontal2Icon />
          <span className="hidden sm:inline">Mirror</span>
        </Toggle>
        <Separator orientation="vertical" className="mx-0.5 h-6 self-center" />
        <Button variant="ghost" className={TOOL_BUTTON} onClick={p.onUndo} disabled={!p.canUndo} aria-label="Undo">
          <Undo2Icon />
          <span className="hidden sm:inline">Undo</span>
        </Button>
        <Button variant="ghost" className={TOOL_BUTTON} onClick={p.onClear} disabled={!p.canClear} aria-label="Clear">
          <Trash2Icon />
          <span className="hidden sm:inline">Clear</span>
        </Button>
        <Button variant="ghost" className={TOOL_BUTTON} onClick={p.onSave} aria-label="Save image">
          {p.saved ? <CheckIcon /> : <DownloadIcon />}
          <span className="hidden sm:inline">Save</span>
        </Button>
      </div>
      <Collapse open={p.tool === "stamp"} className="pointer-events-auto pt-2">
        <StampPicker value={p.stamp} onChange={p.onStamp} />
      </Collapse>
    </div>
  );
}
