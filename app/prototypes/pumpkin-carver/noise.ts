// Small seeded noise toolkit. Pure, no dependencies.

/** Fast seeded PRNG returning [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** 1D gradient (Perlin) noise, output roughly in [-1, 1]. Smooth, non-periodic. */
export function createNoise1D(seed: number) {
  const rand = mulberry32(seed);
  const grads = new Float32Array(256);
  for (let i = 0; i < 256; i++) grads[i] = rand() * 2 - 1;
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const g0 = grads[i & 255];
    const g1 = grads[(i + 1) & 255];
    // Scale so typical output spans most of [-1, 1].
    return 2 * (g0 * f + (g1 * (f - 1) - g0 * f) * fade(f));
  };
}

/** 3D value noise, output in [-1, 1]. Cheap and good enough for color blotches. */
export function createNoise3D(seed: number) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rand() * 2 - 1;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const v = (x: number, y: number, z: number) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = fade(x - xi);
    const w = fade(y - yi);
    const s = fade(z - zi);
    const x00 = lerp(v(xi, yi, zi), v(xi + 1, yi, zi), u);
    const x10 = lerp(v(xi, yi + 1, zi), v(xi + 1, yi + 1, zi), u);
    const x01 = lerp(v(xi, yi, zi + 1), v(xi + 1, yi, zi + 1), u);
    const x11 = lerp(v(xi, yi + 1, zi + 1), v(xi + 1, yi + 1, zi + 1), u);
    return lerp(lerp(x00, x10, w), lerp(x01, x11, w), s);
  };
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
