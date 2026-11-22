// The pre-built run shown on first load (and restored by "Default run").
// A lift carries marbles back to the top, so it loops forever; a switch splits
// the flow between a funnel and a spring that hops marbles into the cup.

import type { Piece } from "./types";

type Spec = Omit<Piece, "id" | "flip"> & { flip?: boolean };

const SPECS: Spec[] = [
  { type: "lift", x: 910, y: 700, angle: 0 },
  { type: "dropper", x: 600, y: 40, angle: 0 },
  { type: "wheel", x: 560, y: 180, angle: 0 },
  { type: "ramp", x: 632, y: 314, angle: -10 },
  { type: "switch", x: 440, y: 470, angle: 0 },
  // right branch: short track into the funnel, then the long return into the lift
  { type: "ramp", x: 545, y: 570, angle: 6 },
  { type: "funnel", x: 735, y: 765, angle: 0 },
  { type: "ramp", x: 678, y: 1142, angle: 7 },
  // left branch: track, curve, track, spring hop into the cup
  { type: "ramp", x: 222, y: 600, angle: -12 },
  { type: "curve", x: 75, y: 665, angle: 0, flip: true },
  { type: "ramp", x: 290, y: 760, angle: 5 },
  { type: "spring", x: 630, y: 935, angle: -35 },
  { type: "cup", x: 230, y: 1160, angle: 0 },
  // catch track under the hop: anything that misses rolls into the cup anyway
  { type: "ramp", x: 440, y: 1072, angle: -12 },
];

export const DEFAULT_PIECES: Piece[] = SPECS.map((s, i) => ({
  id: `d${i}`,
  flip: false,
  ...s,
}));
