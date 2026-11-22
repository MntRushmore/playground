import { defineControls } from "@/lib/controls/schema";

export const SLUG = "doodle-armies";

// --- Field geometry -------------------------------------------------------
/** Logical field width in "field units". Height follows the canvas aspect so a
 *  field unit is always square (no distortion). Positions are stored in these
 *  units, so a battle looks the same on a phone and a desktop. */
export const FIELD_W = 1000;
/** Device pixel ratio cap: sharper beyond 2 isn't worth the fill cost. */
export const MAX_DPR = 2;

// --- Simulation -----------------------------------------------------------
/** Fixed sim timestep (seconds). Battle speed scales how much real time feeds it. */
export const DT = 1 / 60;
/** Max fixed steps per rendered frame, so a slow frame can't spiral. */
export const MAX_SUBSTEPS = 6;
/** Hard cap on live units, for steady 60fps with large armies. */
export const MAX_UNITS = 440;
/** Sim seconds before a battle is force-resolved by remaining HP (no stalemates). */
export const BATTLE_TIMEOUT = 50;
/** Spatial-grid cell size (field units) ~ the largest neighbour query radius. */
export const GRID_CELL = 80;
/** How often (sim seconds) a unit re-acquires its nearest target. Staggered per unit. */
export const RETARGET_INTERVAL = 0.35;

// --- Control panel --------------------------------------------------------
// `mode` is a control (so budget/difficulty can key off it and it persists) but
// it is hidden from the panel (when:() => false) and driven from the toolbar.
export const controls = defineControls({
  mode: {
    type: "select",
    label: "Mode",
    options: ["sandbox", "cpu"],
    optionLabels: { sandbox: "Sandbox", cpu: "vs CPU" },
    default: "sandbox",
    randomize: false,
    when: () => false,
  },
  squadSize: {
    type: "number",
    label: "Brush size",
    min: 1,
    max: 12,
    step: 1,
    default: 5,
    randomRange: [3, 8],
    format: (v) => `${v} wide`,
  },
  speed: {
    type: "number",
    label: "Battle speed",
    min: 0.5,
    max: 3,
    step: 0.1,
    default: 1,
    randomize: false,
    format: (v) => `${v.toFixed(1)}×`,
  },
  budget: {
    type: "number",
    label: "Your budget",
    min: 80,
    max: 400,
    step: 20,
    default: 220,
    randomize: false,
    when: (v) => v.mode === "cpu",
    format: (v) => `${v} pts`,
  },
  difficulty: {
    type: "select",
    label: "Enemy strength",
    options: ["calm", "even", "fierce"],
    optionLabels: { calm: "Calm", even: "Even", fierce: "Fierce" },
    default: "even",
    randomize: false,
    when: (v) => v.mode === "cpu",
  },
  seed: { type: "number", label: "Seed", min: 1, max: 9999, step: 1, default: 7 },
});

/** CPU army budget = your budget × this factor, by difficulty. */
export const DIFFICULTY_FACTOR: Record<string, number> = { calm: 0.7, even: 1, fierce: 1.35 };
