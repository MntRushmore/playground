"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const COLLAPSE_MS = 300;

/**
 * Animates its children's height open/closed (CSS grid 0fr ↔ 1fr trick).
 * Use for any row or section the user adds or removes so the page never jumps.
 *
 *   <Collapse open={showDetails}><Details /></Collapse>
 *
 * Lists: render new items with `appear` so they grow in from zero height.
 * To remove an item, set `open={false}`, then drop it from state after COLLAPSE_MS.
 */
export function Collapse({
  open = true,
  appear = false,
  children,
  className,
}: {
  open?: boolean;
  /** Start collapsed and animate open on mount. */
  appear?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(!appear);
  useEffect(() => {
    if (mounted) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [mounted]);
  const shown = open && mounted;

  return (
    <div
      data-open={shown}
      aria-hidden={!shown}
      inert={!shown}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-(--ease-out-quint)",
        shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
