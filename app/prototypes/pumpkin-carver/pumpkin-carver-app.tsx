"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { CarveToolbar } from "./carve-toolbar";
import { visibleOps } from "./carving";
import { carving, useCarving } from "./carving-store";
import { SLUG, controls } from "./data";
import { PumpkinCanvas, type PumpkinCanvasHandle } from "./pumpkin-canvas";
import { saveImage } from "./save-image";
import { SceneToggles } from "./scene-toggles";
import type { StampId, Tool } from "./types";

const KEY_TOOLS: Record<string, Tool> = { k: "knife", e: "etch", s: "stamp" };

export function PumpkinCarverApp() {
  const c = useControls(SLUG, controls);
  const { ops, prefs } = useCarving();
  const [tool, setTool] = useState<Tool>("knife");
  const [stamp, setStamp] = useState<StampId>("tri");
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<PumpkinCanvasHandle>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let warned = false;
    carving.onSaveFailed(() => {
      if (warned) return;
      warned = true;
      toast.error("Storage is full, so this carving can't be kept after you leave.");
    });
    return () => {
      carving.onSaveFailed(null);
      clearTimeout(savedTimer.current);
    };
  }, []);

  const save = useCallback(async () => {
    const blob = await canvasRef.current?.exportPng();
    if (!blob) {
      toast.error("Couldn't create the image.");
      return;
    }
    if (await saveImage(blob)) {
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1600);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=slider], [role=combobox]")) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "z") {
        e.preventDefault();
        carving.undo();
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (KEY_TOOLS[key]) setTool(KEY_TOOLS[key]);
        else if (key === "m") carving.setPref("mirror", !prefs.mirror);
        else if (key === "l") carving.setPref("dark", !prefs.dark);
        else if (key === "c") carving.setPref("lit", !prefs.lit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs]);

  return (
    // Bounded height: the panel scrolls instead of stretching the canvas past the fold.
    <ControlsLayout panel={<ControlPanel controls={c} />} className="max-h-[calc(100dvh-3.5rem)]">
      <div className="relative min-h-[28rem] flex-1 overflow-hidden">
        <PumpkinCanvas
          ref={canvasRef}
          settings={c.values}
          ready={c.loaded}
          ops={ops}
          lit={prefs.lit}
          dark={prefs.dark}
          tool={tool}
          stamp={stamp}
          mirror={prefs.mirror}
          onCommit={carving.commit}
        />
        <CarveToolbar
          tool={tool}
          onTool={setTool}
          stamp={stamp}
          onStamp={setStamp}
          mirror={prefs.mirror}
          onMirror={(on) => carving.setPref("mirror", on)}
          canUndo={ops.length > 0}
          canClear={visibleOps(ops).length > 0}
          onUndo={carving.undo}
          onClear={carving.clear}
          onSave={save}
          saved={saved}
        />
        <SceneToggles
          lit={prefs.lit}
          onLit={(on) => carving.setPref("lit", on)}
          dark={prefs.dark}
          onDark={(on) => carving.setPref("dark", on)}
        />
      </div>
    </ControlsLayout>
  );
}
