// The battle engine: single source of truth for the world, the draw-phase roster,
// phase/winner, and the UI selections (brush, team, mode). React reads it through
// a cached snapshot (useSyncExternalStore); the canvas drives it each RAF frame.
// No DOM or React here.

import { battleResult, countAlive, settleWorld, stepWorld } from "./combat";
import {
  DIFFICULTY_FACTOR,
  DT,
  FIELD_W,
  GRID_CELL,
  MAX_SUBSTEPS,
  MAX_UNITS,
} from "./data";
import { cpuArmy, demoScenario, randomScenario, starterArmy } from "./presets";
import { createRng, type Rng } from "./rng";
import { Grid } from "./spatial-grid";
import { stats } from "./units";
import type {
  Bounds,
  Mode,
  Phase,
  PlacedUnit,
  Settings,
  Team,
  Unit,
  UnitKind,
  Winner,
  World,
} from "./types";

export type Snapshot = {
  phase: Phase;
  winner: Winner;
  mode: Mode;
  paused: boolean;
  demo: boolean;
  brush: UnitKind;
  drawTeam: Team;
  blueAlive: number;
  redAlive: number;
  blueUnits: number;
  redUnits: number;
  bluePoints: number;
  redPoints: number;
  budget: number;
};

const DEMO_RESTART_MS = 1400;

export class BattleEngine {
  world: World;
  roster: PlacedUnit[] = [];
  phase: Phase = "draw";
  winner: Winner = null;
  mode: Mode = "sandbox";
  brush: UnitKind = "swordsman";
  drawTeam: Team = "blue";
  paused = false;
  demo = false;
  juice = true;

  seed = 7;
  speed = 1;
  squadSize = 5;
  budget = 220;
  difficulty = "even";

  private grid: Grid;
  private rng: Rng = createRng(7);
  private acc = 0;
  private restartAt = 0;
  private demoSeed = 1;
  private initialized = false;
  private listeners = new Set<() => void>();
  private snap: Snapshot;

  constructor(bounds: Bounds) {
    this.world = {
      units: [],
      projectiles: [],
      effects: [],
      bounds,
      time: 0,
      nextId: 1,
      shake: 0,
    };
    this.grid = new Grid(GRID_CELL, bounds.width, bounds.height);
    this.snap = this.build();
  }

  // --- React store -------------------------------------------------------
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  getSnapshot = (): Snapshot => this.snap;

  private notify() {
    this.snap = this.build();
    for (const cb of this.listeners) cb();
  }

  private points(team: Team): number {
    let p = 0;
    for (const u of this.roster) if (u.team === team) p += stats(u.kind).cost;
    return p;
  }
  private count(team: Team): number {
    let n = 0;
    for (const u of this.roster) if (u.team === team) n++;
    return n;
  }
  private build(): Snapshot {
    return {
      phase: this.phase,
      winner: this.winner,
      mode: this.mode,
      paused: this.paused,
      demo: this.demo,
      brush: this.brush,
      drawTeam: this.drawTeam,
      blueAlive: countAlive(this.world.units, "blue"),
      redAlive: countAlive(this.world.units, "red"),
      blueUnits: this.count("blue"),
      redUnits: this.count("red"),
      bluePoints: this.points("blue"),
      redPoints: this.points("red"),
      budget: this.budget,
    };
  }

  // --- Geometry ----------------------------------------------------------
  setBounds(b: Bounds) {
    const old = this.world.bounds;
    if (b.width === old.width && b.height === old.height) return;
    // Positions are normalized to a fixed width, so only Y needs rescaling when
    // the aspect changes. Rescale proportionally so a formation keeps its shape
    // on any screen (phone portrait ↔ desktop landscape).
    const factor = old.height > 0 ? b.height / old.height : 1;
    this.world.bounds = b;
    this.grid = new Grid(GRID_CELL, b.width, b.height);
    const fix = (u: { y: number; kind: UnitKind }) => {
      const r = stats(u.kind).radius;
      u.y = Math.max(r, Math.min(b.height - r, u.y * factor));
    };
    for (const u of this.roster) fix(u);
    for (const u of this.world.units) fix(u);
  }

  private cpuBudget(): number {
    return Math.round(this.budget * (DIFFICULTY_FACTOR[this.difficulty] ?? 1));
  }

  // --- UI selections -----------------------------------------------------
  setJuice(j: boolean) {
    this.juice = j;
  }
  setBrush(k: UnitKind) {
    this.brush = k;
    this.notify();
  }
  setDrawTeam(t: Team) {
    if (this.mode === "cpu") t = "blue";
    this.drawTeam = t;
    this.notify();
  }

  // --- Settings ----------------------------------------------------------
  applySettings(s: Settings) {
    const first = !this.initialized;
    this.speed = s.speed;
    this.squadSize = s.squadSize;
    let changed = false;

    if (s.mode !== this.mode) {
      this.mode = s.mode;
      if (!first) {
        this.endDemo();
        this.onModeChange();
        changed = true;
      }
    }
    const econ = s.budget !== this.budget || s.difficulty !== this.difficulty;
    this.budget = s.budget;
    this.difficulty = s.difficulty;
    if (econ && !first && this.mode === "cpu") {
      this.endDemo();
      this.regenRed();
      changed = true;
    }
    if (s.seed !== this.seed) {
      this.seed = s.seed;
      if (!first) {
        this.endDemo();
        this.onSeedChange();
        changed = true;
      }
    }
    this.initialized = true;
    if (changed) this.notify();
  }

  private blueOnly(): PlacedUnit[] {
    return this.roster.filter((u) => u.team === "blue");
  }
  private onModeChange() {
    this.toDraw();
    if (this.mode === "cpu") {
      // Fresh budgeted challenge: enemy army generated, you draw Blue within budget.
      this.drawTeam = "blue";
      this.roster = cpuArmy(this.seed, this.cpuBudget(), this.world.bounds);
    }
    // → sandbox keeps the current roster so both sides stay editable.
  }
  private regenRed() {
    this.toDraw();
    this.roster = [...this.blueOnly(), ...cpuArmy(this.seed, this.cpuBudget(), this.world.bounds)];
  }
  private onSeedChange() {
    this.toDraw();
    if (this.mode === "sandbox") {
      this.roster = randomScenario(this.seed, this.world.bounds);
    } else {
      this.roster = [
        ...starterArmy(this.seed, this.budget, this.world.bounds),
        ...cpuArmy(this.seed, this.cpuBudget(), this.world.bounds),
      ];
    }
  }

  // --- Placement ---------------------------------------------------------
  /** Drop a row of `squadSize` brush units centred on (x,y), spread along the
   *  perpendicular (perpX, perpY). Respects the CPU budget and the unit cap. */
  placeCluster(x: number, y: number, perpX: number, perpY: number): number {
    if (this.phase !== "draw") return 0;
    const team = this.drawTeam;
    if (this.mode === "cpu" && team === "red") return 0;
    const kind = this.brush;
    const s = stats(kind);
    const spacing = s.radius * 2.3;
    const n = this.squadSize;
    const b = this.world.bounds;
    let placed = 0;
    for (let i = 0; i < n; i++) {
      if (this.roster.length >= MAX_UNITS) break;
      if (this.mode === "cpu" && team === "blue" && this.points("blue") + s.cost > this.budget) break;
      const off = (i - (n - 1) / 2) * spacing;
      const jx = (Math.random() - 0.5) * s.radius * 0.8;
      const jy = (Math.random() - 0.5) * s.radius * 0.8;
      const px = Math.max(s.radius, Math.min(b.width - s.radius, x + perpX * off + jx));
      const py = Math.max(s.radius, Math.min(b.height - s.radius, y + perpY * off + jy));
      this.roster.push({ team, kind, x: px, y: py });
      placed++;
    }
    if (placed) this.notify();
    return placed;
  }

  /** Clear the player's units (sandbox: everything; CPU: only your Blue). */
  clear() {
    this.toDraw();
    this.roster = this.mode === "cpu" ? this.roster.filter((u) => u.team === "red") : [];
    this.notify();
  }

  // --- Battle lifecycle --------------------------------------------------
  private toDraw() {
    this.phase = "draw";
    this.winner = null;
    this.paused = false;
    this.world.units = [];
    this.world.projectiles = [];
    this.world.effects = [];
    this.world.shake = 0;
    this.acc = 0;
  }

  private spinUp(seed: number) {
    const src = this.roster.length > MAX_UNITS ? this.roster.slice(0, MAX_UNITS) : this.roster;
    this.rng = createRng(seed);
    const units: Unit[] = src.map((p, i) => {
      const s = stats(p.kind);
      return {
        id: i + 1,
        team: p.team,
        kind: p.kind,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        hp: s.hp,
        maxHp: s.hp,
        cd: this.rng.next() * 0.4,
        target: null,
        retarget: this.rng.next() * 0.3,
        flash: 0,
        wob: this.rng.next() * 1000,
        dead: false,
      };
    });
    this.world.units = units;
    this.world.projectiles = [];
    this.world.effects = [];
    this.world.time = 0;
    this.world.shake = 0;
    this.acc = 0;
    this.phase = "battle";
    this.winner = null;
    this.paused = false;
  }

  /** Start a battle from the current roster. No-op if the field is empty. */
  startBattle() {
    if (this.phase === "battle" || this.roster.length === 0) return;
    this.demo = false;
    this.spinUp(this.seed);
    this.notify();
  }

  /** Stop a running/finished battle and return to drawing (roster preserved). */
  reset() {
    this.demo = false;
    this.toDraw();
    this.notify();
  }

  togglePause() {
    if (this.phase !== "battle") return;
    this.paused = !this.paused;
    this.notify();
  }

  private endBattle(result: Winner) {
    this.phase = "ended";
    this.winner = result;
    if (this.demo) this.restartAt = now() + DEMO_RESTART_MS;
    this.notify();
  }

  // --- Demo loop (lively mid-battle scene for the gallery thumbnail) ------
  startDemo() {
    this.demo = true;
    this.demoSeed = this.seed;
    this.roster = demoScenario(this.demoSeed, this.world.bounds);
    this.spinUp(this.demoSeed * 7 + 1);
    this.notify();
  }
  private nextDemo() {
    this.demoSeed = (this.demoSeed % 9999) + 137;
    this.roster = demoScenario(this.demoSeed, this.world.bounds);
    this.spinUp(this.demoSeed * 7 + 1);
    this.notify();
  }
  endDemo() {
    if (!this.demo) return;
    this.demo = false;
    this.toDraw();
    this.roster = this.mode === "cpu" ? cpuArmy(this.seed, this.cpuBudget(), this.world.bounds) : [];
    this.notify();
  }

  /** Load a validated, persisted roster into the draw phase. */
  setRoster(roster: PlacedUnit[]) {
    this.demo = false;
    this.toDraw();
    this.roster = roster;
    this.notify();
  }

  /** First-load scene: restore a saved army, else run the demo, else a draw slate. */
  init(roster: PlacedUnit[] | null, allowDemo: boolean) {
    if (roster && roster.length > 0) {
      this.setRoster(roster);
      if (this.mode === "cpu" && !this.roster.some((u) => u.team === "red")) {
        this.roster = [...this.roster, ...cpuArmy(this.seed, this.cpuBudget(), this.world.bounds)];
        this.notify();
      }
    } else if (allowDemo) {
      this.startDemo();
    } else {
      this.toDraw();
      this.roster = this.mode === "cpu" ? cpuArmy(this.seed, this.cpuBudget(), this.world.bounds) : [];
      this.notify();
    }
  }

  // --- Per-frame tick (driven by the canvas RAF) -------------------------
  advance(realDt: number) {
    if (this.phase === "battle" && !this.paused) {
      this.acc += realDt * this.speed;
      let steps = 0;
      while (this.acc >= DT && steps < MAX_SUBSTEPS) {
        stepWorld(this.world, this.grid, this.rng, DT, this.juice);
        this.acc -= DT;
        steps++;
      }
      if (this.acc > DT) this.acc = 0; // drop backlog after a stall / tab switch
      const res = battleResult(this.world);
      if (res) this.endBattle(res);
    } else if (this.phase === "ended") {
      settleWorld(this.world, Math.min(realDt, 0.05) * this.speed);
      if (this.demo && now() >= this.restartAt) this.nextDemo();
    }
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function makeEngine(): BattleEngine {
  return new BattleEngine({ width: FIELD_W, height: FIELD_W * 0.62 });
}
