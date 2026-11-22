// Uniform spatial hash grid for neighbour queries. Rebuilt each sim step from
// the live units, it keeps separation and target-finding near O(n) with
// hundreds of units on the field.

import type { Team, Unit } from "./types";

export class Grid {
  private cell: number;
  private cols: number;
  private rows: number;
  private cells: Unit[][];

  constructor(cell: number, width: number, height: number) {
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  private cx(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
  }
  private cy(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
  }

  build(units: Unit[]): void {
    for (const c of this.cells) c.length = 0;
    for (const u of units) {
      if (u.dead) continue;
      this.cells[this.cy(u.y) * this.cols + this.cx(u.x)].push(u);
    }
  }

  /** Visit every unit whose cell overlaps the square of side 2*radius around (x,y). */
  forNeighbors(x: number, y: number, radius: number, cb: (u: Unit) => void): void {
    const r = Math.ceil(radius / this.cell);
    const gx = this.cx(x);
    const gy = this.cy(y);
    for (let j = Math.max(0, gy - r); j <= Math.min(this.rows - 1, gy + r); j++) {
      for (let i = Math.max(0, gx - r); i <= Math.min(this.cols - 1, gx + r); i++) {
        const bucket = this.cells[j * this.cols + i];
        for (const u of bucket) cb(u);
      }
    }
  }

  /** Nearest living enemy to (x,y) via expanding rings. Returns null if none. */
  nearestEnemy(x: number, y: number, team: Team, maxRings: number): Unit | null {
    const gx = this.cx(x);
    const gy = this.cy(y);
    let best: Unit | null = null;
    let bestD = Infinity;
    for (let r = 0; r <= maxRings; r++) {
      // Once we have a hit, any closer one must sit within ceil(bestD/cell) rings.
      if (best && (r - 1) * this.cell > Math.sqrt(bestD)) break;
      const i0 = Math.max(0, gx - r);
      const i1 = Math.min(this.cols - 1, gx + r);
      const j0 = Math.max(0, gy - r);
      const j1 = Math.min(this.rows - 1, gy + r);
      for (let j = j0; j <= j1; j++) {
        const edgeRow = j === gy - r || j === gy + r;
        for (let i = i0; i <= i1; i++) {
          if (!edgeRow && i !== gx - r && i !== gx + r) continue; // ring perimeter only
          const bucket = this.cells[j * this.cols + i];
          for (const u of bucket) {
            if (u.team === team) continue;
            const dx = u.x - x;
            const dy = u.y - y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = u;
            }
          }
        }
      }
    }
    return best;
  }
}
