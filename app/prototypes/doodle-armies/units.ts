// Unit roster and stats. These numbers ARE the game's content, tuned for a
// rock-paper-scissors feel: cheap swarms beat ranged, ranged kites tanks,
// tanks crush melee, mages punish clumps, cavalry runs down archers, healers
// make any army last longer.

import type { UnitKind, UnitStats } from "./types";

export const UNIT_STATS: Record<UnitKind, UnitStats> = {
  swordsman: {
    kind: "swordsman",
    name: "Swordsman",
    blurb: "Cheap melee. Swarms overwhelm archers.",
    cost: 10,
    hp: 58,
    damage: 9,
    attackSpeed: 1.15,
    range: 2,
    moveSpeed: 98,
    radius: 11,
    style: "melee",
  },
  archer: {
    kind: "archer",
    name: "Archer",
    blurb: "Fragile ranged. Kites slow tanks.",
    cost: 14,
    hp: 24,
    damage: 10,
    attackSpeed: 1,
    range: 188,
    moveSpeed: 76,
    radius: 10,
    style: "ranged",
    projectileSpeed: 430,
  },
  cavalry: {
    kind: "cavalry",
    name: "Cavalry",
    blurb: "Fast melee. Runs down archers and mages.",
    cost: 20,
    hp: 88,
    damage: 16,
    attackSpeed: 1,
    range: 3,
    moveSpeed: 158,
    radius: 13,
    style: "melee",
  },
  healer: {
    kind: "healer",
    name: "Healer",
    blurb: "Mends nearby allies. No attack.",
    cost: 22,
    hp: 44,
    damage: 10,
    attackSpeed: 1,
    range: 140,
    moveSpeed: 84,
    radius: 11,
    style: "heal",
  },
  knight: {
    kind: "knight",
    name: "Knight",
    blurb: "Slow tank. Cleaves melee swarms.",
    cost: 28,
    hp: 190,
    damage: 18,
    attackSpeed: 0.78,
    range: 3,
    moveSpeed: 56,
    radius: 15,
    style: "melee",
    cleaveRadius: 30,
    cleaveFrac: 0.5,
  },
  mage: {
    kind: "mage",
    name: "Mage",
    blurb: "Slow splash. Melts clumps.",
    cost: 30,
    hp: 34,
    damage: 17,
    attackSpeed: 0.55,
    range: 232,
    moveSpeed: 60,
    radius: 12,
    style: "aoe",
    aoeRadius: 62,
    projectileSpeed: 300,
  },
  giant: {
    kind: "giant",
    name: "Giant",
    blurb: "Huge HP and cleaving hits. Expensive.",
    cost: 55,
    hp: 440,
    damage: 44,
    attackSpeed: 0.5,
    range: 4,
    moveSpeed: 48,
    radius: 24,
    style: "melee",
    cleaveRadius: 52,
    cleaveFrac: 0.6,
  },
};

/** Roster order used for the brush toolbar and random army weighting. */
export const ROSTER: UnitKind[] = [
  "swordsman",
  "archer",
  "cavalry",
  "healer",
  "knight",
  "mage",
  "giant",
];

export function stats(kind: UnitKind): UnitStats {
  return UNIT_STATS[kind];
}

/** Attack reach between two units: ranged uses raw range, melee uses body contact. */
export function reach(a: UnitStats, bRadius: number): number {
  if (a.style === "melee") return a.radius + bRadius + a.range;
  return a.range;
}
