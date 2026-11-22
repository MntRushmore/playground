"use client";

import { LayoutTemplateIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { DEFAULT_LAYOUT, SLUG, controls } from "./data";
import { MachineToolbar } from "./machine-toolbar";
import type { MarbleMachine } from "./machine";
import { MarbleCanvas } from "./marble-canvas";
import { SoundPrompt } from "./sound-prompt";
import { useMarbleAudio } from "./use-marble-audio";

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.getAttribute("role") === "slider");

export function MarbleMusicApp() {
  const c = useControls(SLUG, controls);
  const machineRef = useRef<MarbleMachine | null>(null);
  const [emitting, setEmitting] = useState(true);
  const audio = useMarbleAudio(c.values);
  const { unlock } = audio;

  // Space: pause/resume drops. Delete/Backspace: remove the selected bar. Escape: deselect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        setEmitting((v) => !v);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        machineRef.current?.removeSelected();
      } else if (e.key === "Escape") {
        machineRef.current?.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlock]);

  const panel = (
    <div className="flex flex-col">
      <ControlPanel controls={c} />
      <div className="mt-3 border-t border-border pt-3">
        <Button
          variant="ghost"
          className="h-11 w-full justify-start"
          onClick={() => machineRef.current?.resetLayout(DEFAULT_LAYOUT)}
        >
          <LayoutTemplateIcon />
          Default layout
        </Button>
      </div>
    </div>
  );

  return (
    // Bounded height: otherwise the tall panel stretches the page and pushes the
    // canvas's bottom toolbar below the fold on desktop.
    <ControlsLayout panel={panel} className="max-h-[calc(100dvh-3.5rem)]">
      <MarbleCanvas
        settings={c.values}
        emitting={emitting}
        live={audio.sound !== "locked"}
        machineRef={machineRef}
        onNote={audio.play}
        onPointerDown={unlock}
      />
      <SoundPrompt visible={audio.sound === "locked"} onStart={unlock} />
      <MachineToolbar
        visible={audio.sound !== "locked"}
        emitting={emitting}
        sound={audio.sound}
        onToggleEmitting={() => setEmitting((v) => !v)}
        onAddBar={() => {
          unlock();
          machineRef.current?.addBar();
        }}
        onNewLayout={() => {
          unlock();
          machineRef.current?.newLayout();
        }}
        onToggleSound={audio.toggle}
      />
    </ControlsLayout>
  );
}
