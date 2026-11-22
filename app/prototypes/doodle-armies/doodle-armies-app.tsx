"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { readStorage, writeStorage } from "@/lib/storage";
import { BattlefieldCanvas } from "./battlefield-canvas";
import { MAX_UNITS, SLUG, controls } from "./data";
import { makeEngine } from "./engine";
import { Hud } from "./hud";
import { ResultBanner } from "./result-banner";
import { ROSTER } from "./units";
import { UnitPalette } from "./unit-palette";
import type { Mode, PlacedUnit } from "./types";

function loadRoster(): PlacedUnit[] | null {
  const raw = readStorage<unknown>(SLUG, "roster", null);
  if (!Array.isArray(raw)) return null;
  const out: PlacedUnit[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const { team, kind, x, y } = it as Record<string, unknown>;
    if (
      (team === "blue" || team === "red") &&
      typeof kind === "string" &&
      (ROSTER as string[]).includes(kind) &&
      typeof x === "number" &&
      Number.isFinite(x) &&
      typeof y === "number" &&
      Number.isFinite(y)
    ) {
      out.push({ team, kind: kind as PlacedUnit["kind"], x, y });
      if (out.length >= MAX_UNITS) break;
    }
  }
  return out;
}

export function DoodleArmiesApp() {
  const c = useControls(SLUG, controls);
  const reducedMotion = useReducedMotion();
  const [engine] = useState(makeEngine);
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const started = useRef(false);

  // Mount + ongoing settings sync.
  useEffect(() => {
    if (!c.loaded) return;
    if (!started.current) {
      engine.applySettings(c.values);
      engine.init(loadRoster(), !reducedMotion);
      started.current = true;
    } else {
      engine.applySettings(c.values);
    }
  }, [engine, c.loaded, c.values, reducedMotion]);

  // Persist the drawn roster (debounced), never while the demo or a battle runs.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsub = engine.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (engine.phase === "draw" && !engine.demo) writeStorage(SLUG, "roster", engine.roster);
      }, 350);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [engine]);

  return (
    <ControlsLayout panel={<ControlPanel controls={c} />}>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <BattlefieldCanvas engine={engine} onInteract={() => engine.endDemo()} />
        <Hud
          snap={snap}
          onMode={(m: Mode) => c.set("mode", m)}
          onBattle={() => engine.startBattle()}
          onPause={() => engine.togglePause()}
          onReset={() => engine.reset()}
          onClear={() => engine.clear()}
        />
        {snap.phase === "draw" && !snap.demo && (
          <UnitPalette snap={snap} onBrush={(k) => engine.setBrush(k)} onTeam={(t) => engine.setDrawTeam(t)} />
        )}
        {snap.phase === "ended" && !snap.demo && (
          <ResultBanner snap={snap} onReset={() => engine.reset()} onRandomize={() => c.randomize()} />
        )}
      </div>
    </ControlsLayout>
  );
}
