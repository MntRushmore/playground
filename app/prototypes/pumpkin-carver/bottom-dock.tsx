"use client";

import { CheckIcon, ImageDownIcon, PlusIcon, SaveIcon, Undo2Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FACES, FACE_ORDER } from "./faces";
import { HueSwatch } from "./hue-swatch";
import { shapeSvg } from "./shapes";
import type { FaceId, Tool, Variety } from "./types";

const HINT: Record<Tool, string> = {
  carve: "Drag across the pumpkin to carve.",
  etch: "Drag to scrape the skin thin.",
  patch: "Drag over a cut to fill it back in.",
};

/** A face preset drawn from its own shapes (whiskers and other strokes as lines). */
function FaceIcon({ id }: { id: FaceId }) {
  const ops = FACES[id].ops;
  return (
    <svg viewBox="-0.86 -0.62 1.72 1.24" className="h-6 w-8" aria-hidden>
      {ops.map((op, i) =>
        op.t === "stamp" ? (
          <path
            key={i}
            d={shapeSvg(op.s)}
            fill="currentColor"
            fillRule="evenodd"
            transform={`translate(${op.x} ${op.y}) scale(${op.f ? -op.k : op.k} ${op.k})`}
          />
        ) : (
          <polyline key={i} points={op.p.join(" ")} fill="none" stroke="currentColor" strokeWidth={0.05} strokeLinecap="round" />
        )
      )}
    </svg>
  );
}

const ICON_BTN = "size-11 rounded-xl";

type Props = {
  tool: Tool;
  showHint: boolean;
  onFace: (id: FaceId) => void;
  canUndo: boolean;
  onUndo: () => void;
  onNew: () => void;
  onSave: () => void;
  onExport: () => void;
  saved: boolean;
  variety: Variety;
  hue: number;
  onColor: (variety: Variety, hue: number) => void;
  sound: boolean;
  onSound: (on: boolean) => void;
};

export function BottomDock(p: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p
        aria-hidden={!p.showHint}
        className={`rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-md transition-opacity duration-300 ease-(--ease-out-quint) ${p.showHint ? "opacity-100" : "opacity-0"}`}
      >
        {HINT[p.tool]}
      </p>
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-border bg-background/80 shadow-lg backdrop-blur-md">
        <div className="grid grid-cols-7 p-1" role="group" aria-label="Face presets">
          {FACE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => p.onFace(id)}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
            >
              <FaceIcon id={id} />
              <span className="text-[11px] leading-none text-muted-foreground">{FACES[id].label}</span>
            </button>
          ))}
        </div>
        <Separator />
        {/* pr-14 leaves room for the shared controls button on phones. */}
        <div className="flex items-center gap-0.5 p-1 pr-14 md:pr-1">
          <Button variant="ghost" className={ICON_BTN} onClick={p.onUndo} disabled={!p.canUndo} aria-label="Undo">
            <Undo2Icon />
          </Button>
          <Button variant="ghost" className="h-11 rounded-xl px-3" onClick={p.onNew} aria-label="New pumpkin">
            <PlusIcon />
            <span className="hidden sm:inline">New</span>
          </Button>
          <Button variant="ghost" className="h-11 rounded-xl px-3" onClick={p.onSave} aria-label="Save image">
            {p.saved ? <CheckIcon /> : <SaveIcon />}
            <span className="hidden sm:inline">Save</span>
          </Button>
          <div className="ml-auto flex items-center gap-0.5">
            <HueSwatch variety={p.variety} hue={p.hue} onPick={p.onColor} />
            <Button variant="ghost" className={ICON_BTN} onClick={p.onExport} aria-label="Share image">
              <ImageDownIcon />
            </Button>
            <Button
              variant="ghost"
              className={ICON_BTN}
              onClick={() => p.onSound(!p.sound)}
              aria-label={p.sound ? "Mute" : "Sound on"}
              aria-pressed={p.sound}
            >
              {p.sound ? <Volume2Icon /> : <VolumeXIcon />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
