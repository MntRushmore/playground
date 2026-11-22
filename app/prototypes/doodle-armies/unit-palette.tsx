"use client";

import {
  HeartPulse,
  Mountain,
  Rabbit,
  Shield,
  Sparkles,
  Sword,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Snapshot } from "./engine";
import { teamSwatch } from "./palette";
import { ROSTER, UNIT_STATS } from "./units";
import type { Team, UnitKind } from "./types";

const ICON: Record<UnitKind, LucideIcon> = {
  swordsman: Sword,
  archer: Target,
  cavalry: Rabbit,
  healer: HeartPulse,
  knight: Shield,
  mage: Sparkles,
  giant: Mountain,
};

function TeamButton({
  team,
  active,
  onClick,
}: {
  team: Team;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Draw ${team} army`}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium capitalize transition-colors",
        active ? "border-border bg-secondary text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"
      )}
    >
      <span className="size-2.5 rounded-full" style={{ backgroundColor: teamSwatch(team) }} />
      {team}
    </button>
  );
}

export function UnitPalette({
  snap,
  onBrush,
  onTeam,
}: {
  snap: Snapshot;
  onBrush: (k: UnitKind) => void;
  onTeam: (t: Team) => void;
}) {
  const selected = UNIT_STATS[snap.brush];
  return (
    <div className="pointer-events-auto absolute right-16 bottom-3 left-3 flex flex-col gap-1.5 rounded-xl border border-border bg-card/85 p-2 shadow-sm backdrop-blur-sm md:right-3">
      <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
        <span className="min-w-0 truncate">
          <span className="font-medium text-foreground">{selected.name}</span>
          <span className="text-muted-foreground"> · {selected.blurb}</span>
        </span>
        {snap.mode === "sandbox" && (
          <div className="flex shrink-0 gap-1">
            <TeamButton team="blue" active={snap.drawTeam === "blue"} onClick={() => onTeam("blue")} />
            <TeamButton team="red" active={snap.drawTeam === "red"} onClick={() => onTeam("red")} />
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ROSTER.map((kind) => {
          const s = UNIT_STATS[kind];
          const Icon = ICON[kind];
          const active = snap.brush === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              aria-label={`${s.name}, ${s.cost} points`}
              onClick={() => onBrush(kind)}
              className={cn(
                "flex h-14 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] transition-colors",
                active
                  ? "border-primary bg-secondary text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-5" />
              <span className="font-mono tabular-nums">{s.cost}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
