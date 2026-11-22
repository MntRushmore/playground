// Small, fast, seeded PRNG so armies and battles are reproducible given a seed.
// (Self-contained; prototypes never import from one another.)

export type Rng = {
  next: () => number;
  range: (lo: number, hi: number) => number;
  int: (lo: number, hi: number) => number;
  pick: <T>(items: readonly T[]) => T;
  /** Standard-normal-ish value in roughly [-1, 1] (two uniforms averaged). */
  spread: () => number;
};

/** mulberry32: returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed || 1);
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    spread: () => (next() + next() - 1),
  };
}
