"use client";

import { Cpu, Pause, Pencil, Play, RotateCcw, Square, Swords, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Snapshot } from "./engine";
import { teamSwatch } from "./palette";
import type { Mode, Team } from "./types";

function Dot({ team }: { team: Team }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: teamSwatch(team) }}
    />
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Cpu;
  label: string;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn("h-9 px-2.5", active && "shadow-sm")}
    >
      <Icon />
      <span className="hidden text-xs sm:inline">{label}</span>
    </Button>
  );
}

export function Hud({
  snap,
  onMode,
  onBattle,
  onPause,
  onReset,
  onClear,
}: {
  snap: Snapshot;
  onMode: (m: Mode) => void;
  onBattle: () => void;
  onPause: () => void;
  onReset: () => void;
  onClear: () => void;
}) {
  const { phase, mode, paused } = snap;
  const inBattle = phase === "battle";
  const blueGone = snap.mode === "cpu" ? snap.bluePoints === 0 : snap.blueUnits === 0;
  const empty = snap.blueUnits === 0 && snap.redUnits === 0;

  const blueLabel =
    phase === "draw"
      ? mode === "cpu"
        ? `${snap.bluePoints}/${snap.budget}`
        : `${snap.blueUnits}`
      : `${snap.blueAlive}`;
  const redLabel = phase === "draw" ? `${snap.redUnits}` : `${snap.redAlive}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border bg-card/85 p-1 shadow-sm backdrop-blur-sm">
        <ModeButton active={mode === "sandbox"} onClick={() => onMode("sandbox")} icon={Pencil} label="Sandbox" />
        <ModeButton active={mode === "cpu"} onClick={() => onMode("cpu")} icon={Cpu} label="vs CPU" />
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/85 px-2.5 py-1.5 font-mono text-xs tabular-nums shadow-sm backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <Dot team="blue" />
            {blueLabel}
          </span>
          <span className="text-muted-foreground">vs</span>
          <span className="flex items-center gap-1.5">
            {redLabel}
            <Dot team="red" />
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!inBattle && (
            <>
              <Button
                onClick={onBattle}
                disabled={empty || blueGone}
                className="h-11 px-3.5"
                aria-label={phase === "ended" ? "Battle again" : "Start battle"}
              >
                <Swords />
                <span className="hidden sm:inline">
                  {phase === "ended" ? "Again" : "Battle"}
                </span>
              </Button>
              {phase === "ended" ? (
                <Button variant="secondary" onClick={onReset} className="h-11 px-3.5" aria-label="Redraw">
                  <RotateCcw />
                  <span className="hidden sm:inline">Redraw</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={onClear}
                  disabled={empty}
                  className="h-11 px-3"
                  aria-label="Clear army"
                >
                  <Trash2 />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}
            </>
          )}
          {inBattle && (
            <>
              <Button
                variant="secondary"
                onClick={onPause}
                className="h-11 px-3.5"
                aria-label={paused ? "Resume battle" : "Pause battle"}
              >
                {paused ? <Play /> : <Pause />}
                <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
              </Button>
              <Button variant="ghost" onClick={onReset} className="h-11 px-3" aria-label="Stop battle">
                <Square />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
