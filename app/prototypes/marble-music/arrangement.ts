// Layout validation and generation. Pure: sizes in, normalized layouts out.

import { DEFAULT_LAYOUT, DEGREE_COUNT } from "./data";
import {
  barDistance,
  barEnds,
  barGeom,
  barThickness,
  clamp,
  distToSegment,
  lengthForDegree,
  marbleRadius,
  stageOf,
  toNormX,
  toPxX,
} from "./geometry";
import type { Bar, Emitter, Layout, Size } from "./types";

const MAX_BARS = 32;
const deg = (d: number) => (d * Math.PI) / 180;

export function newBarId(rand: () => number = Math.random) {
  return `b${Math.floor(rand() * 36 ** 6).toString(36)}`;
}

export function cloneLayout(layout: Layout): Layout {
  return {
    bars: layout.bars.map((b) => ({ ...b })),
    emitters: layout.emitters.map((e) => ({ ...e })),
  };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validate untrusted (persisted) data. Returns null when it's unusable. */
export function sanitizeLayout(input: unknown): Layout | null {
  if (!input || typeof input !== "object") return null;
  const src = input as { bars?: unknown; emitters?: unknown };
  if (!Array.isArray(src.bars)) return null;
  const seen = new Set<string>();
  const bars: Bar[] = [];
  for (const raw of src.bars.slice(0, MAX_BARS)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    if (!num(b.x) || !num(b.y) || !num(b.angle) || !num(b.degree)) continue;
    let id = typeof b.id === "string" && b.id ? b.id : newBarId();
    while (seen.has(id)) id = newBarId();
    seen.add(id);
    bars.push({
      id,
      x: clamp(b.x, 0, 1),
      y: clamp(b.y, 0, 1),
      angle: b.angle,
      degree: clamp(Math.round(b.degree), 0, DEGREE_COUNT - 1),
    });
  }
  const rawEmitters = Array.isArray(src.emitters) ? src.emitters : [];
  const emitters: Emitter[] = DEFAULT_LAYOUT.emitters.map((fallback, i) => {
    const e = rawEmitters[i] as Record<string, unknown> | undefined;
    return e && num(e.x) && num(e.y) ? { x: clamp(e.x, 0, 1), y: clamp(e.y, 0, 1) } : { ...fallback };
  });
  return { bars, emitters };
}

/** Is this candidate clear of every placed bar (room for a marble to pass)? */
function fits(candidate: Bar, placed: Bar[], size: Size, gap: number) {
  const g = barGeom(candidate, size);
  const e = barEnds(g);
  const margin = barThickness(size) * 1.5;
  const st = stageOf(size);
  if (Math.min(e.ax, e.bx) < st.x + margin || Math.max(e.ax, e.bx) > st.x + st.width - margin) return false;
  // Keep clear of the floating toolbar along the bottom edge.
  if (Math.max(e.ay, e.by) > size.height - 76) return false;
  return placed.every((p) => barDistance(g, barGeom(p, size)) > gap);
}

function tilt(rand: () => number, towardRight: boolean) {
  const a = deg(13 + rand() * 20);
  return towardRight ? a : -a;
}

/**
 * A fresh, playable arrangement. Keeps the emitters where they are and grows a zigzag
 * "chain" of bars below each active one: every bar is placed where the marble leaving
 * the previous bar's low end will land, so drops reliably travel the whole chain.
 * Symmetric emitters sometimes get mirrored chains. Remaining space gets bars that lean
 * toward the middle. Lower bars are longer (lower notes), like a real instrument.
 */
export function randomLayout(
  size: Size,
  emitters: Emitter[],
  active: number,
  rand: () => number = Math.random
): Layout {
  const st = stageOf(size);
  const H = size.height;
  const unit = Math.min(st.width, H);
  const gap = barThickness(size) * 1.2 + marbleRadius(size, 1) * 3.2;
  const bars: Bar[] = [];
  const target = 9 + Math.floor(rand() * 4);

  const degreeFor = (y: number) =>
    clamp(Math.round((1 - (y - 0.12) / 0.82) * (DEGREE_COUNT - 1) + (rand() - 0.5) * 4), 0, DEGREE_COUNT - 1);

  const chain = (start: Emitter, firstDir: number, links: number, mirrorOf?: Bar[]) => {
    const made: Bar[] = [];
    if (mirrorOf) {
      for (const b of mirrorOf) {
        const twin: Bar = { ...b, id: newBarId(rand), x: 1 - b.x, angle: -b.angle };
        if (fits(twin, bars, size, gap)) bars.push(twin);
      }
      return made;
    }
    let x = toPxX(start.x, size);
    let y = start.y * H;
    let dir = firstDir;
    for (let k = 0; k < links; k++) {
      const cy = y + H * (0.08 + rand() * 0.07) + (k === 0 ? H * 0.05 : 0);
      if (cy > H * 0.93) break;
      let placed: Bar | null = null;
      for (let attempt = 0; attempt < 6 && !placed; attempt++) {
        const degree = degreeFor(cy / H);
        const len = lengthForDegree(degree, size);
        const a = deg(14 + rand() * 18);
        // Land on the upper part so the marble rolls along most of the bar.
        const cx = x + dir * len * (0.2 + rand() * 0.14) * Math.cos(a);
        const bar: Bar = { id: newBarId(rand), x: toNormX(cx, size), y: cy / H, angle: dir * a, degree };
        if (fits(bar, bars, size, gap)) placed = bar;
      }
      if (!placed) break;
      bars.push(placed);
      made.push(placed);
      const len = lengthForDegree(placed.degree, size);
      const a = Math.abs(placed.angle);
      x = toPxX(placed.x, size) + dir * (len / 2) * Math.cos(a) + dir * unit * (0.03 + rand() * 0.05);
      y = placed.y * H + (len / 2) * Math.sin(a);
      const next = rand() < 0.78 ? -dir : dir;
      dir = x < st.x + st.width * 0.16 ? 1 : x > st.x + st.width * 0.84 ? -1 : next;
    }
    return made;
  };

  const live = emitters.slice(0, Math.max(1, active));
  const symmetric = live.length === 2 && Math.abs(live[0].x - (1 - live[1].x)) < 0.04 && Math.abs(live[0].y - live[1].y) < 0.03;
  const links = live.length === 1 ? 6 : live.length === 2 ? 4 : 3;
  if (symmetric && rand() < 0.4) {
    const first = chain(live[0], live[0].x < 0.5 ? 1 : -1, links);
    chain(live[1], 0, 0, first);
  } else {
    live.forEach((em) => chain(em, (em.x < 0.5 ? 1 : -1) * (rand() < 0.8 ? 1 : -1), links));
  }

  // Fill toward the target count.
  for (let i = 0; i < 120 && bars.length < target; i++) {
    const x = 0.1 + rand() * 0.8;
    const y = 0.25 + rand() * 0.68;
    const bar: Bar = {
      id: newBarId(rand),
      x,
      y,
      angle: tilt(rand, x < 0.5 ? rand() < 0.8 : rand() < 0.2),
      degree: degreeFor(y),
    };
    if (fits(bar, bars, size, gap)) bars.push(bar);
  }

  return { bars, emitters: emitters.map((e) => ({ ...e })) };
}

/** Where to put a newly added bar: the open spot farthest from everything else. */
export function placeNewBar(layout: Layout, size: Size, activeEmitters: number, rand: () => number = Math.random): Bar {
  const used = new Map<number, number>();
  for (const b of layout.bars) used.set(b.degree, (used.get(b.degree) ?? 0) + 1);
  const degree = [...Array(DEGREE_COUNT).keys()]
    .filter((d) => d > 1)
    .sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0) + (rand() - 0.5) * 0.9)[0];

  let best: Bar | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 80; i++) {
    const x = 0.15 + rand() * 0.7;
    const y = 0.2 + rand() * 0.6;
    const bar: Bar = { id: newBarId(rand), x, y, angle: tilt(rand, x < 0.5), degree };
    const g = barGeom(bar, size);
    const e = barEnds(g);
    const st = stageOf(size);
    if (Math.min(e.ax, e.bx) < st.x + 12 || Math.max(e.ax, e.bx) > st.x + st.width - 12) continue;
    let score = Infinity;
    for (const other of layout.bars) score = Math.min(score, barDistance(g, barGeom(other, size)));
    for (const em of layout.emitters.slice(0, activeEmitters)) {
      score = Math.min(score, distToSegment(toPxX(em.x, size), em.y * size.height, e.ax, e.ay, e.bx, e.by));
    }
    // Prefer the middle of the canvas a little, so it's easy to grab.
    score -= Math.hypot(x - 0.5, y - 0.5) * st.width * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = bar;
    }
  }
  return best ?? { id: newBarId(rand), x: 0.5, y: 0.5, angle: deg(18), degree };
}
