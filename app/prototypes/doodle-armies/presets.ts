// Army generation: themed, seeded, budgeted armies placed in a sensible
// formation (ranged at the back, melee and tanks at the front). Deterministic
// given a seed + bounds, so Randomize and replays reproduce.

import { FIELD_W } from "./data";
import { createRng, type Rng } from "./rng";
import { ROSTER, stats } from "./units";
import type { Bounds, PlacedUnit, Team, UnitKind } from "./types";

type Side = "left" | "right";

/** 0 = back edge of the zone, 1 = front (toward the centre line). */
const DEPTH: Record<UnitKind, number> = {
  giant: 0.96,
  knight: 0.9,
  cavalry: 0.82,
  swordsman: 0.72,
  healer: 0.42,
  mage: 0.16,
  archer: 0.2,
};

type Archetype = Partial<Record<UnitKind, number>>;

// Spend shares per archetype (roughly fractions of the budget).
const ARCHETYPES: Archetype[] = [
  { swordsman: 0.3, archer: 0.24, knight: 0.16, cavalry: 0.1, mage: 0.1, healer: 0.1 },
  { swordsman: 0.52, cavalry: 0.2, archer: 0.16, healer: 0.12 },
  { giant: 0.3, knight: 0.24, mage: 0.2, healer: 0.14, archer: 0.12 },
  { archer: 0.44, mage: 0.24, swordsman: 0.2, healer: 0.12 },
  { cavalry: 0.44, swordsman: 0.24, archer: 0.2, healer: 0.12 },
  { knight: 0.3, swordsman: 0.28, archer: 0.22, healer: 0.1, mage: 0.1 },
];

function zoneX(side: Side, depth: number): number {
  // Blue (left) front is near centre-left; red (right) front near centre-right.
  return side === "left"
    ? FIELD_W * (0.08 + depth * 0.34)
    : FIELD_W * (0.92 - depth * 0.34);
}

function placeGroup(
  out: PlacedUnit[],
  kind: UnitKind,
  count: number,
  team: Team,
  side: Side,
  bounds: Bounds,
  rng: Rng
) {
  if (count <= 0) return;
  const s = stats(kind);
  const top = bounds.height * 0.08;
  const bottom = bounds.height * 0.92;
  const usable = bottom - top;
  const baseX = zoneX(side, DEPTH[kind]);
  const dir = side === "left" ? -1 : 1;
  // Spread each kind evenly across the FULL height (continuous line), wrapping
  // into depth columns only when a line would overlap, so armies meet as a broad
  // front rather than a few sparse clumps.
  const spacing = s.radius * 2.3;
  const maxRows = Math.max(1, Math.floor(usable / spacing));
  const cols = Math.max(1, Math.ceil(count / maxRows));
  const rowsPerCol = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const fy = rowsPerCol <= 1 ? 0.5 : row / (rowsPerCol - 1);
    const y = top + fy * usable + rng.spread() * s.radius * 0.7;
    const x = baseX + col * spacing * dir + rng.spread() * s.radius * 0.5;
    out.push({
      team,
      kind,
      x: Math.max(s.radius, Math.min(FIELD_W - s.radius, x)),
      y: Math.max(s.radius, Math.min(bounds.height - s.radius, y)),
    });
  }
}

/** Build one themed army for a team on a side, spending up to `budget` points. */
export function buildArmy(
  team: Team,
  side: Side,
  budget: number,
  bounds: Bounds,
  rng: Rng
): PlacedUnit[] {
  const arch = ARCHETYPES[Math.floor(rng.next() * ARCHETYPES.length)];
  const out: PlacedUnit[] = [];
  let spent = 0;
  for (const kind of ROSTER) {
    const share = arch[kind];
    if (!share) continue;
    const cost = stats(kind).cost;
    const count = Math.max(0, Math.round((budget * share) / cost));
    placeGroup(out, kind, count, team, side, bounds, rng);
    spent += count * cost;
  }
  // Spend leftover budget on cheap swordsmen so armies feel full.
  const sw = stats("swordsman").cost;
  const extra = Math.floor((budget - spent) / sw);
  if (extra > 0) placeGroup(out, "swordsman", extra, team, side, bounds, rng);
  return out;
}

/** A dense two-army clash for the auto-running demo (drives the thumbnail). */
export function demoScenario(seed: number, bounds: Bounds): PlacedUnit[] {
  const rng = createRng(seed * 131 + 17);
  return [
    ...buildArmy("blue", "left", 470, bounds, rng),
    ...buildArmy("red", "right", 470, bounds, rng),
  ];
}

/** Sandbox Randomize: two fresh random armies. */
export function randomScenario(seed: number, bounds: Bounds): PlacedUnit[] {
  const rng = createRng(seed * 977 + 3);
  return [
    ...buildArmy("blue", "left", rng.int(250, 380), bounds, rng),
    ...buildArmy("red", "right", rng.int(250, 380), bounds, rng),
  ];
}

/** CPU mode: a red army scaled by difficulty factor. */
export function cpuArmy(seed: number, budget: number, bounds: Bounds): PlacedUnit[] {
  return buildArmy("red", "right", Math.round(budget), bounds, createRng(seed * 613 + 29));
}

/** CPU mode starter Blue army (editable suggestion within budget). */
export function starterArmy(seed: number, budget: number, bounds: Bounds): PlacedUnit[] {
  return buildArmy("blue", "left", budget, bounds, createRng(seed * 349 + 5));
}
