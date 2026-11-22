"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SWATCHES } from "./data";
import type { Variety } from "./types";

type Props = {
  variety: Variety;
  hue: number;
  onPick: (variety: Variety, hue: number) => void;
};

const matches = (s: (typeof SWATCHES)[number], variety: Variety, hue: number) =>
  s.variety === variety && (variety !== "orange" || Math.abs(s.hue - hue) < 5);

/** Pumpkin color: a swatch button with a small palette. Colors are pumpkin content. */
export function HueSwatch({ variety, hue, onPick }: Props) {
  const current = SWATCHES.find((s) => matches(s, variety, hue)) ?? SWATCHES[0];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="size-11 rounded-xl p-0" aria-label="Pumpkin color">
          <span
            className="size-6 rounded-full ring-2 ring-border ring-offset-2 ring-offset-background"
            style={{ backgroundColor: current.css }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto flex-row gap-1 p-1.5">
        {SWATCHES.map((s) => {
          const on = matches(s, variety, hue);
          return (
            <Button
              key={s.label}
              variant="ghost"
              className="size-11 rounded-xl p-0"
              aria-label={s.label}
              aria-pressed={on}
              onClick={() => onPick(s.variety, s.hue)}
            >
              <span
                className={`size-7 rounded-full ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : ""}`}
                style={{ backgroundColor: s.css }}
              />
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
