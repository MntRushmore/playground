import type { ControlValues } from "@/lib/controls/schema";
import type { controls } from "./data";

export type Settings = ControlValues<typeof controls>;

export type Team = "blue" | "red";
export type Mode = "sandbox" | "cpu";
export type Phase = "draw" | "battle" | "ended";
export type Winner = Team | "draw" | null;

export type UnitKind =
  | "swordsman"
  | "archer"
  | "knight"
  | "mage"
  | "healer"
  | "giant"
  | "cavalry";

export type AttackStyle = "melee" | "ranged" | "aoe" | "heal";

export type UnitStats = {
  kind: UnitKind;
  name: string;
  blurb: string;
  cost: number;
  hp: number;
  /** Damage per hit (or heal per tick for healers). */
  damage: number;
  /** Attacks per second. */
  attackSpeed: number;
  /** Attack reach in field units. Melee uses body contact; this is the extra reach. */
  range: number;
  /** Move speed in field units per second. */
  moveSpeed: number;
  /** Body radius in field units (collision + drawing). */
  radius: number;
  style: AttackStyle;
  /** Splash radius for aoe attacks / mage orbs. */
  aoeRadius?: number;
  /** Projectile travel speed (ranged / aoe) in field units per second. */
  projectileSpeed?: number;
  /** Melee cleave: splash radius around the struck target (field units). */
  cleaveRadius?: number;
  /** Fraction of damage dealt to other enemies in the cleave radius. */
  cleaveFrac?: number;
};

/** A unit as placed during the draw phase (the persisted roster). */
export type PlacedUnit = { team: Team; kind: UnitKind; x: number; y: number };

/** A live unit during a battle. */
export type Unit = {
  id: number;
  team: Team;
  kind: UnitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  /** Seconds until this unit can attack again. */
  cd: number;
  /** Current target, or null. */
  target: Unit | null;
  /** Seconds until the next target re-acquisition. */
  retarget: number;
  /** Hit-flash timer (seconds remaining). */
  flash: number;
  /** Stable per-unit value for hand-drawn wobble. */
  wob: number;
  dead: boolean;
};

export type Projectile = {
  team: Team;
  kind: UnitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  target: Unit | null;
  /** Last known target position (used if the target dies mid-flight). */
  tx: number;
  ty: number;
  damage: number;
  aoeRadius: number;
  speed: number;
  /** Safety lifetime (seconds). */
  life: number;
  dead: boolean;
};

export type EffectKind = "number" | "splat" | "poof" | "ring" | "flash";

export type Effect = {
  kind: EffectKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Which team the effect belongs to; color is resolved at render time by theme. */
  team: Team | null;
  /** Damage / heal amount for floating numbers. */
  value: number;
  /** Whether a number is a heal (drawn with a + and the heal color). */
  heal: boolean;
  /** Start / end radius for rings and poofs. */
  r0: number;
  r1: number;
  /** Per-effect seed for splat scatter. */
  seed: number;
};

/** Field bounds in field units. Width is fixed (FIELD_W); height follows aspect. */
export type Bounds = { width: number; height: number };

/** Mutable battle state advanced by the simulation each fixed step. */
export type World = {
  units: Unit[];
  projectiles: Projectile[];
  effects: Effect[];
  bounds: Bounds;
  /** Sim seconds elapsed in the current battle. */
  time: number;
  nextId: number;
  /** Current screen-shake magnitude (field units), decays over time. */
  shake: number;
};

/** Design-token colors read from the DOM at runtime (paper / ink). */
export type ThemeInk = { background: string; foreground: string; dark: boolean };
