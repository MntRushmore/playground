"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Subject + control panel.
 *  - md and up: panel in a fixed-width column to the right; never covers the subject.
 *  - mobile: floating button opens a non-modal bottom sheet (no overlay, subject stays live).
 *
 *   <ControlsLayout panel={<ControlPanel controls={controls} />}>
 *     <MyCanvas settings={controls.values} />
 *   </ControlsLayout>
 */
export function ControlsLayout({
  panel,
  children,
  className,
}: {
  panel: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative flex min-h-0 flex-1", className)}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>

      <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border p-4 md:block">
        {panel}
      </aside>

      <div className="md:hidden">
        <Drawer open={open} onOpenChange={setOpen} modal={false}>
          <DrawerTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              aria-label="Controls"
              className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] size-12 rounded-full shadow-md"
            >
              <SlidersHorizontalIcon />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[50dvh]">
            <DrawerTitle className="sr-only">Controls</DrawerTitle>
            <div className="overflow-y-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {panel}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
