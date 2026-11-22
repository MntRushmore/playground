"use client";

import { cn } from "@/lib/utils";
import { themeSwatches, tintColor } from "./colors";
import type { ThemeId } from "./types";

/**
 * Soft wash behind the keys: the theme's colors while idle, then the color of the
 * last note played, fading slowly from one to the next.
 */
export function StageTint({ theme, midi, dark }: { theme: ThemeId; midi: number | null; dark: boolean }) {
  const swatches = themeSwatches(theme, dark);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(120%_90%_at_50%_0%,black,transparent_75%)]"
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-1000 ease-(--ease-out-quint)",
          midi === null ? "opacity-40 dark:opacity-30" : "opacity-0"
        )}
        style={{ backgroundImage: `linear-gradient(90deg, ${swatches.join(", ")})` }}
      />
      <div
        className={cn(
          "absolute inset-0 transition-[background-color,opacity] duration-700 ease-(--ease-out-quint)",
          midi === null ? "opacity-0" : "opacity-45 dark:opacity-35"
        )}
        style={{ backgroundColor: midi === null ? undefined : tintColor(theme, midi, dark) }}
      />
    </div>
  );
}
