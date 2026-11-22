"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { keyVars } from "./colors";
import type { KeyLayout } from "./types";

/**
 * One key: a dark "lip" body with a colored face on top. Pressing slides the face
 * down over the lip (a chunky toy-button feel) and makes it glow.
 * Hit testing happens on the wrapper (`data-midi`), so the small gaps between keys still play.
 */
export const PianoKey = memo(function PianoKey({
  layout,
  color,
  label,
  pressed,
  order,
  fontSize,
}: {
  layout: KeyLayout;
  color: string;
  label: string | null;
  pressed: boolean;
  /** Position in the entrance wave. */
  order: number;
  fontSize: number;
}) {
  const { black } = layout;
  return (
    <div
      data-midi={layout.midi}
      data-key={layout.id}
      data-pressed={pressed}
      aria-label={label ?? undefined}
      className={cn(
        "absolute top-0 animate-in duration-700 fill-mode-backwards ease-(--ease-out-quint) fade-in-0",
        black
          ? "z-10 px-[2px] slide-in-from-top-6"
          : "bottom-0 px-[3px] slide-in-from-bottom-8 data-[pressed=true]:z-[5]"
      )}
      style={{
        left: `${layout.left}%`,
        width: `${layout.width}%`,
        height: black ? `${layout.height}%` : undefined,
        animationDelay: `${order * 24}ms`,
        ...keyVars(color, black),
      }}
    >
      <div className="relative h-full">
        {/* Body / front lip */}
        <div
          className={cn(
            "absolute inset-0 bg-(--lip)",
            black
              ? "rounded-t-sm rounded-b-xl shadow-[0_8px_14px_-8px_var(--lip)]"
              : "rounded-t-lg rounded-b-2xl"
          )}
        />
        {/* Face */}
        <div
          data-pressed={pressed}
          className={cn(
            "absolute inset-x-0 top-0 flex items-end justify-center overflow-hidden bg-(--key)",
            "transition-[translate,filter,box-shadow] duration-[420ms] ease-(--ease-out-quint)",
            "data-[pressed=true]:brightness-[1.07] data-[pressed=true]:duration-[60ms]",
            black
              ? "bottom-[7px] rounded-t-sm rounded-b-xl data-[pressed=true]:translate-y-[5px] data-[pressed=true]:shadow-[0_0_18px_2px_var(--glow)]"
              : "bottom-[11px] rounded-t-lg rounded-b-2xl data-[pressed=true]:translate-y-[8px] data-[pressed=true]:shadow-[0_0_30px_4px_var(--glow)]"
          )}
        >
          {/* Soft top sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-(--shine) to-transparent" />
          {label && (
            <span
              className={cn(
                "relative mb-[12%] flex h-[1.9em] min-w-[1.9em] items-center justify-center rounded-full px-[0.35em]",
                "bg-(--chip) font-semibold text-(--chip-ink) tabular-nums",
                "transition-[scale] duration-[420ms] ease-(--ease-out-quint)",
                pressed && "scale-115 duration-[60ms]"
              )}
              style={{ fontSize }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
