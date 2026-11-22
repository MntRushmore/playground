// Pumpkin and stem meshes as plain typed arrays. Pure: no three.js, no DOM.
//
// The body is a lathe-like surface in cylindrical coordinates: latitude θ sets the
// horizontal radius and height (with dimples at both poles), and the angle φ around the
// vertical axis modulates the radius with one rounded lobe per rib and a V-crease between.
// φ = 0 faces the camera, so a lobe sits front and center for the face.

import { SHAPE_DIMS, STEM_COLORS } from "./data";
import { createNoise3D, mulberry32, smoothstep } from "./noise";
import type { BodyDims, PumpkinShape, SkinPalette } from "./types";

export type MeshData = {
  positions: Float32Array;
  /** sRGB 0–1 per vertex. */
  colors: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
};

export type BodyParams = {
  shape: PumpkinShape;
  ribs: number;
  ribDepth: number;
  seed: number;
  palette: SkinPalette;
};

const TAU = Math.PI * 2;
const TOP_DIMPLE = 0.2;
const BOTTOM_DIMPLE = 0.12;

export const bodyDims = (shape: PumpkinShape): BodyDims => SHAPE_DIMS[shape];

/** Height of the top pole (where the stem sits), in world units. */
export const stemBaseY = (dims: BodyDims) => dims.b * (1 - TOP_DIMPLE);

function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 1) + 1) % 1;
  const k = (n: number) => (n + hh * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function gridIndices(cols: number, rows: number) {
  const idx = new Uint32Array(cols * rows * 6);
  let o = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v00 = j * (cols + 1) + i;
      const v10 = v00 + 1;
      const v01 = v00 + cols + 1;
      const v11 = v01 + 1;
      idx[o++] = v00; idx[o++] = v10; idx[o++] = v11;
      idx[o++] = v00; idx[o++] = v11; idx[o++] = v01;
    }
  }
  return idx;
}

export function buildBody({ shape, ribs, ribDepth, seed, palette }: BodyParams): MeshData {
  const { a, b } = bodyDims(shape);
  const n = Math.round(ribs);
  const depth = ribDepth * 0.13;
  const rand = mulberry32(seed * 7919 + n);
  const lobeAmp = Array.from({ length: n }, () => 0.9 + rand() * 0.18);
  const noise = createNoise3D(seed);
  const cols = n * 24;
  const rows = 112;

  const count = (cols + 1) * (rows + 1);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const { base, top, crease } = palette;

  for (let j = 0; j <= rows; j++) {
    const theta = -Math.PI / 2 + (Math.PI * j) / rows;
    const c = Math.max(0, Math.cos(theta));
    const s = Math.sin(theta);
    const radius = a * Math.pow(c, 0.62);
    let y = b * s;
    if (s > 0) y -= b * TOP_DIMPLE * Math.exp(-((c / 0.26) ** 2));
    else y += b * BOTTOM_DIMPLE * Math.exp(-((c / 0.3) ** 2));
    const topT = smoothstep(0.75, 1.45, theta);
    const bottomT = smoothstep(-0.5, -1.4, theta);

    for (let i = 0; i <= cols; i++) {
      const phi = -Math.PI + (TAU * i) / cols;
      const k = (n * phi) / TAU;
      const lobeIdx = Math.round(k);
      const local = k - lobeIdx;
      const lobe = Math.pow(Math.cos(Math.PI * local), 0.55);
      const amp = lobeAmp[((lobeIdx % n) + n) % n];
      const cx = Math.cos(phi);
      const sx = Math.sin(phi);
      const bump = 1 + 0.016 * noise(cx * 1.6 + 3, sx * 1.6, theta * 1.4);
      const r = radius * (1 - depth + depth * lobe * amp) * bump;

      const v = j * (cols + 1) + i;
      positions[v * 3] = r * sx;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = r * cx;
      uvs[v * 2] = i / cols;
      uvs[v * 2 + 1] = j / rows;

      // Color: creases darker and redder, shoulders toward the stem a little greener,
      // the base slightly shadowed, plus low-frequency blotches and vertical streaks.
      const cr = Math.pow(1 - lobe, 1.6);
      const blotch = noise(cx * 2.2, sx * 2.2, theta * 2.5 + 11);
      const streak = noise(phi * n * 0.9, theta * 0.7, 23.5);
      let h = lerp(base[0], crease[0], cr);
      let sat = lerp(base[1], crease[1], cr);
      let l = lerp(base[2], crease[2], cr);
      h = lerp(h, top[0], topT * 0.8);
      sat = lerp(sat, top[1], topT * 0.8);
      l = lerp(l, top[2], topT * 0.6);
      l *= 1 + blotch * 0.07 + streak * 0.04 - bottomT * 0.12;
      h += blotch * 0.006;
      const [rr, gg, bb] = hslToRgb01(h, Math.min(1, sat), Math.min(0.95, Math.max(0.05, l)));
      colors[v * 3] = rr;
      colors[v * 3 + 1] = gg;
      colors[v * 3 + 2] = bb;
    }
  }

  return { positions, colors, uvs, indices: gridIndices(cols, rows) };
}

export function buildStem(shape: PumpkinShape, seed: number): MeshData {
  const dims = bodyDims(shape);
  const rand = mulberry32(seed * 104729 + 3);
  const y0 = stemBaseY(dims) - 0.03;
  const length = 0.3 + rand() * 0.12;
  const lean = (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.45);
  const twist = (rand() - 0.5) * 3;
  const noise = createNoise3D(seed + 99);
  const segs = 40;
  const ring = 48;
  const ridges = 6;

  const center = (t: number): [number, number, number] => [
    lean * Math.pow(t, 1.7) * length,
    y0 + t * length * (1 - 0.15 * Math.abs(lean) * t),
    0.14 * t * t * length,
  ];

  const count = (segs + 1) * (ring + 1) + ring + 2;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const put = (v: number, p: number[], col: number[], u: number, w: number) => {
    positions.set(p, v * 3);
    colors.set(col, v * 3);
    uvs[v * 2] = u;
    uvs[v * 2 + 1] = w;
  };

  const radiusAt = (t: number, ang: number) => {
    const base = 0.075 * (1 - 0.28 * t) * (1 + 1.1 * Math.exp(-t * 7));
    const ridge = Math.pow(0.5 + 0.5 * Math.cos(ridges * ang + twist * t), 2);
    return base * (0.93 + 0.14 * ridge);
  };

  for (let j = 0; j <= segs; j++) {
    const t = j / segs;
    const c = center(t);
    const ahead = center(Math.min(1, t + 0.01));
    const behind = center(Math.max(0, t - 0.01));
    let tx = ahead[0] - behind[0];
    let ty = ahead[1] - behind[1];
    let tz = ahead[2] - behind[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // Frame: N = normalize(X - (X·T)T), B = T × N.
    let nx = 1 - tx * tx;
    let ny = -tx * ty;
    let nz = -tx * tz;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    for (let i = 0; i <= ring; i++) {
      const ang = (TAU * i) / ring;
      const r = radiusAt(t, ang);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const p = [
        c[0] + r * (nx * ca + bx * sa),
        c[1] + r * (ny * ca + by * sa),
        c[2] + r * (nz * ca + bz * sa),
      ];
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(ridges * ang + twist * t), 2);
      const fiber = noise(ang * 6, t * 3, 1.5);
      const along = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const from = t < 0.5 ? STEM_COLORS.base : STEM_COLORS.mid;
      const to = t < 0.5 ? STEM_COLORS.mid : STEM_COLORS.tip;
      const h = lerp(from[0], to[0], along);
      const s = lerp(from[1], to[1], along);
      const l = lerp(from[2], to[2], along) * (0.78 + 0.34 * ridge + 0.1 * fiber);
      put(j * (ring + 1) + i, p, hslToRgb01(h, s, l), i / ring, t);
    }
  }

  // Flat cut face on top, with its own vertices for a crisp edge.
  const capStart = (segs + 1) * (ring + 1);
  const tipC = center(1);
  const cutCol = hslToRgb01(STEM_COLORS.cut[0], STEM_COLORS.cut[1], STEM_COLORS.cut[2]);
  put(capStart, [tipC[0], tipC[1] + 0.004, tipC[2]], cutCol, 0.5, 1);
  for (let i = 0; i <= ring; i++) {
    const src = segs * (ring + 1) + i;
    const p = Array.from(positions.subarray(src * 3, src * 3 + 3));
    const shade = 0.82 + 0.18 * Math.cos((TAU * i) / ring + 1);
    put(capStart + 1 + i, p, cutCol.map((v) => v * shade), i / ring, 1);
  }

  const side = gridIndices(ring, segs);
  const indices = new Uint32Array(side.length + ring * 3);
  indices.set(side);
  let o = side.length;
  for (let i = 0; i < ring; i++) {
    indices[o++] = capStart;
    indices[o++] = capStart + 1 + i;
    indices[o++] = capStart + 1 + i + 1;
  }
  return { positions, colors, uvs, indices };
}
