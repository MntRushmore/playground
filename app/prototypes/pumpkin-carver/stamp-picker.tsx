"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { STAMPS, STAMP_ORDER } from "./data";
import type { StampId } from "./types";

export function StampPicker({ value, onChange }: { value: StampId; onChange: (id: StampId) => void }) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      onValueChange={(v) => v && onChange(v as StampId)}
      aria-label="Stamp shape"
      className="rounded-2xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-md"
    >
      {STAMP_ORDER.map((id) => (
        <ToggleGroupItem
          key={id}
          value={id}
          aria-label={STAMPS[id].label}
          title={STAMPS[id].label}
          className="size-11 rounded-xl p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <svg viewBox="-1.15 -1.15 2.3 2.3" className="size-6" aria-hidden>
            <path d={STAMPS[id].path} fill="currentColor" />
          </svg>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
