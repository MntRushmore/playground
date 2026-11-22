"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { BottomDock } from "./bottom-dock";
import { carving, useCarving } from "./carving-store";
import { SLUG, controls } from "./data";
import { PumpkinCanvas, type PumpkinCanvasHandle } from "./pumpkin-canvas";
import { downloadImage, shareImage } from "./save-image";
import { sound } from "./sound";
import { TopBar } from "./top-bar";
import type { FaceId, Tool, Variety } from "./types";

const KEY_TOOLS: Record<string, Tool> = { k: "carve", e: "etch", p: "patch" };

export function PumpkinCarverApp() {
  const c = useControls(SLUG, controls);
  const { ops, prefs } = useCarving();
  const [tool, setTool] = useState<Tool>("carve");
  const [saved, setSaved] = useState(false);
  const [carved, setCarved] = useState(false);
  const canvasRef = useRef<PumpkinCanvasHandle>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { set: setControl } = c;

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

  // Remember the sound preference without starting audio before a gesture.
  useEffect(() => sound.setEnabled(prefs.sound, false), [prefs.sound]);
  // Candle crackle follows the flame (and stops when the tab is hidden).
  useEffect(() => sound.setCrackle(prefs.lit), [prefs.lit]);

  const exportImage = useCallback(async (share: boolean) => {
    const blob = await canvasRef.current?.exportPng();
    if (!blob) {
      toast.error("Couldn't create the image.");
      return;
    }
    if (share) {
      await shareImage(blob);
      return;
    }
    downloadImage(blob);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }, []);

  const setLit = useCallback((on: boolean) => {
    if (on) sound.ignite();
    else sound.snuff();
    carving.setPref("lit", on);
  }, []);
  const setSound = useCallback((on: boolean) => {
    sound.setEnabled(on);
    carving.setPref("sound", on);
  }, []);
  const applyFace = useCallback((id: FaceId) => {
    sound.thunk();
    carving.applyFace(id);
  }, []);
  const pickColor = useCallback(
    (variety: Variety, hue: number) => {
      setControl("variety", variety);
      setControl("hue", hue);
    },
    [setControl]
  );
  const newPumpkin = useCallback(() => {
    carving.clear();
    setControl("seed", 1 + Math.floor(Math.random() * 999));
  }, [setControl]);

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
        else if (key === "l") carving.setPref("dark", !prefs.dark);
        else if (key === "c") setLit(!prefs.lit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, setLit]);

  return (
    // Bounded height: the panel scrolls instead of stretching the canvas past the fold.
    <ControlsLayout panel={<ControlPanel controls={c} />} className="max-h-[calc(100dvh-3.5rem)]">
      <div className="relative min-h-[32rem] flex-1 overflow-hidden">
        <PumpkinCanvas
          ref={canvasRef}
          settings={c.values}
          ready={c.loaded}
          ops={ops}
          lit={prefs.lit}
          dark={prefs.dark}
          tool={tool}
          onCommit={carving.commit}
          onStroke={() => setCarved(true)}
        />
        <TopBar
          tool={tool}
          onTool={setTool}
          lit={prefs.lit}
          onLit={setLit}
          dark={prefs.dark}
          onDark={(on) => carving.setPref("dark", on)}
        />
        <BottomDock
          tool={tool}
          showHint={!carved}
          onFace={applyFace}
          canUndo={ops.length > 0}
          onUndo={carving.undo}
          onNew={newPumpkin}
          onSave={() => exportImage(false)}
          onExport={() => exportImage(true)}
          saved={saved}
          variety={c.values.variety}
          hue={c.values.hue}
          onColor={pickColor}
          sound={prefs.sound}
          onSound={setSound}
        />
      </div>
    </ControlsLayout>
  );
}
