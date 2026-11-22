"use client";

import { RotateCcwIcon, ShuffleIcon } from "lucide-react";
import { useId } from "react";
import { Collapse } from "@/components/motion/collapse";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Control, ControlSchema } from "@/lib/controls/schema";
import { cn } from "@/lib/utils";
import type { ControlsApi } from "./use-controls";

/** Renders every control in the schema plus Randomize + Reset. */
export function ControlPanel<S extends ControlSchema>({
  controls,
  className,
}: {
  controls: ControlsApi<S>;
  className?: string;
}) {
  const { schema, values, set, reset, randomize } = controls;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex gap-2 pb-2">
        <Button variant="secondary" className="h-11 flex-1" onClick={randomize}>
          <ShuffleIcon />
          Randomize
        </Button>
        <Button variant="ghost" className="h-11" onClick={reset} aria-label="Reset">
          <RotateCcwIcon />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>
      {Object.entries(schema).map(([key, control]) => {
        const row = (
          <ControlRow
            key={key}
            control={control}
            value={values[key as keyof S]}
            onChange={(v) => set(key as keyof S, v as never)}
          />
        );
        if (!control.when) return row;
        return (
          <Collapse key={key} open={control.when(values as Record<string, unknown>)}>
            {row}
          </Collapse>
        );
      })}
    </div>
  );
}

function ControlRow({
  control,
  value,
  onChange,
}: {
  control: Control;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = useId();

  switch (control.type) {
    case "number": {
      const v = value as number;
      return (
        <div className="flex flex-col">
          <div className="flex items-center justify-between pt-2 text-sm">
            <Label htmlFor={id}>{control.label}</Label>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {control.format ? control.format(v) : v}
            </span>
          </div>
          {/* h-11 makes the whole row a 44px touch target */}
          <Slider
            id={id}
            className="h-11"
            min={control.min}
            max={control.max}
            step={control.step ?? (control.max - control.min) / 100}
            value={[v]}
            onValueChange={([next]) => onChange(next)}
            aria-label={control.label}
          />
        </div>
      );
    }
    case "boolean":
      return (
        <div className="flex h-11 items-center justify-between text-sm">
          <Label htmlFor={id} className="h-full flex-1">
            {control.label}
          </Label>
          <Switch id={id} checked={value as boolean} onCheckedChange={onChange} />
        </div>
      );
    case "select":
      return (
        <div className="flex h-11 items-center justify-between gap-3 text-sm">
          <Label htmlFor={id}>{control.label}</Label>
          <Select value={value as string} onValueChange={onChange}>
            <SelectTrigger id={id} className="h-11 min-w-32 data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {control.options.map((opt) => (
                <SelectItem key={opt} value={opt} className="min-h-11 sm:min-h-8">
                  {control.optionLabels?.[opt] ?? opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "color":
      return (
        <div className="flex h-11 items-center justify-between text-sm">
          <Label htmlFor={id}>{control.label}</Label>
          <input
            id={id}
            type="color"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="size-11 cursor-pointer rounded-lg border border-border bg-transparent p-1 [&::-moz-color-swatch]:rounded-md [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
          />
        </div>
      );
  }
}
