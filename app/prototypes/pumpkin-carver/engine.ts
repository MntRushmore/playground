// The carving scene as a plain object: owns the canvases, decides what to rebuild when
// inputs change, animates lights and flicker, and exports a PNG. React only feeds it.

import { buildCavity } from "./cavity";
import { glowPalette, skinPalette } from "./color";
import { canvas2d, renderPng } from "./export-png";
import { EXPORT_PLATE_PX, MAX_PLATE_PX } from "./data";
import { renderFallbackPlates } from "./fallback-plates";
import { STEADY, createFlicker } from "./flicker";
import { drawFrame } from "./frame";
import { buildDerived, createLayers, type Layers, paintCommitted, paintLive, type Region } from "./layers";
import { createPumpkinRenderer, type PlateParams } from "./pumpkin-render";
import { type PlateRect, faceTransform, plateRect, screenToFace, strokeBoxes } from "./space";
import { visibleOps } from "./carving";
import type { FrameState, Op, PumpkinPlates, Settings, StampOp, StrokeOp, ThemeColors } from "./types";

type Live = (StrokeOp | StampOp)[];

const bodyKey = (s: Settings) => JSON.stringify([s.shape, s.variety, s.hue, s.ribs, s.ribDepth, s.seed]);

export function createEngine(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const renderer = createPumpkinRenderer();
  const flicker = createFlicker(7);

  let settings: Settings | null = null;
  let ops: Live = [];
  let live: Live = [];
  let preview: StampOp | null = null;
  let theme: ThemeColors = { background: "#000", foreground: "#fff", night: "#000", dark: true };
  let reduced = false;
  let target = { lit: true, dark: true };
  const anim = { dark: 1, flame: 1, appear: 0 };
  let snapAnim = true;

  let dpr = 1;
  /** Where the plate renders at full size, and where it's drawn (shrinks above a sheet). */
  let rect: PlateRect = { x: 0, y: 0, size: 0 };
  let view: PlateRect = rect;
  let inset = { target: 0, current: 0 };
  let plates: PumpkinPlates | null = null;
  let layers: Layers | null = null;
  let cavity: { dark: HTMLCanvasElement; lit: HTMLCanvasElement } | null = null;
  let lastBodyKey = "";
  const dirty = { plates: true, committed: true, live: true, cavity: true };
  /** Plate-px boxes touched by the stroke in progress since the last rebuild (null: all). */
  let liveRegion: NonNullable<Region> | null = null;
  let liveOp: StrokeOp | null = null;
  let liveSeen = 0;

  let raf = 0;
  let last = 0;
  let disposed = false;

  const plateParams = (s: Settings, size: number): PlateParams => ({
    shape: s.shape,
    ribs: s.ribs,
    ribDepth: s.ribDepth,
    seed: s.seed,
    palette: skinPalette(s.variety, s.hue),
    size,
  });

  const renderPlates = (s: Settings, size: number, into?: PumpkinPlates) =>
    renderer ? renderer.render(plateParams(s, size), into) : renderFallbackPlates(plateParams(s, size));

  function rebuild() {
    const s = settings;
    if (!s || rect.size < 16) return;
    const size = rect.size;
    const ft = faceTransform(s.shape, size);
    if (!layers || layers.size !== size) {
      layers = createLayers(size);
      cavity = { dark: canvas2d(size), lit: canvas2d(size) };
      dirty.plates = dirty.committed = dirty.cavity = true;
    }
    if (dirty.plates || !plates || plates.size !== size) {
      plates = renderPlates(s, size, plates ?? undefined);
      dirty.plates = false;
      dirty.committed = true;
    }
    const glow = glowPalette(s.warmth);
    if (dirty.committed) {
      paintCommitted(layers, ops, ft, plates.bodyDay);
      dirty.committed = false;
      dirty.live = true;
      liveRegion = null;
    }
    if (dirty.live) {
      const region = liveRegion && liveRegion.length ? liveRegion : null;
      paintLive(layers, live, ft, plates.bodyDay, region);
      buildDerived(layers, plates, ft, skinPalette(s.variety, s.hue), glow, live.length === 0, region);
      dirty.live = false;
      liveRegion = [];
    }
    if (dirty.cavity && cavity) {
      buildCavity(cavity.dark.getContext("2d")!, cavity.lit.getContext("2d")!, ft, glow, s.seed);
      dirty.cavity = false;
    }
  }

  function layoutView() {
    if (inset.current < 0.5) {
      view = rect;
      return;
    }
    const fit = plateRect(canvas.width, canvas.height - inset.current * dpr, dpr, rect.size);
    view = fit.size < rect.size ? fit : rect;
  }

  function step(dt: number) {
    const ease = (v: number, to: number, tau: number) => (reduced || snapAnim ? to : v + (to - v) * (1 - Math.exp(-dt / tau)));
    inset.current = Math.abs(inset.target - inset.current) < 0.5 ? inset.target : ease(inset.current, inset.target, 0.09);
    layoutView();
    anim.dark = ease(anim.dark, target.dark ? 1 : 0, 0.28);
    anim.flame = ease(anim.flame, target.lit ? 1 : 0, target.lit ? 0.4 : 0.18);
    if (plates) anim.appear = reduced ? 1 : Math.min(1, anim.appear + dt / 0.35);
    if (plates) snapAnim = false;
  }

  function draw(now: number) {
    const s = settings;
    if (!s) return;
    if (!plates || !layers || !cavity) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const f = reduced ? STEADY : flicker(now / 1000, s.flicker);
    const state: FrameState = { dark: anim.dark, flame: anim.flame, ...f };
    drawFrame(ctx, {
      layers,
      plates,
      cavityDark: cavity.dark,
      cavityLit: cavity.lit,
      ft: faceTransform(s.shape, rect.size),
      rect: view,
      theme,
      glow: glowPalette(s.warmth),
      glowAmount: s.glow,
      state,
      appear: anim.appear,
      preview,
      dpr,
    });
  }

  function tick(now: number) {
    raf = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    rebuild();
    step(dt);
    draw(now);
    const settling =
      Math.abs(anim.dark - (target.dark ? 1 : 0)) > 0.002 ||
      Math.abs(anim.flame - (target.lit ? 1 : 0)) > 0.002 ||
      anim.appear < 1 ||
      inset.current !== inset.target;
    if (!reduced || settling) schedule();
  }

  function schedule() {
    if (!raf && !disposed) raf = requestAnimationFrame(tick);
  }

  return {
    setSettings(next: Settings) {
      const prev = settings;
      settings = next;
      const key = bodyKey(next);
      if (key !== lastBodyKey) {
        lastBodyKey = key;
        dirty.plates = true;
      }
      if (prev && prev.shape !== next.shape) dirty.committed = true;
      if (!prev || prev.warmth !== next.warmth || prev.seed !== next.seed || prev.shape !== next.shape) {
        dirty.cavity = true;
        dirty.live = true;
      }
      if (prev && (prev.variety !== next.variety || prev.hue !== next.hue)) dirty.live = true;
      schedule();
    },
    setOps(next: readonly Op[]) {
      ops = visibleOps(next);
      dirty.committed = true;
      schedule();
    },
    setLive(next: Live) {
      const first = next.length === 1 ? next[0] : null;
      const op = first && first.t !== "stamp" ? first : null;
      // Same stroke growing (or a fresh one): only its newest segment needs rebuilding.
      const growing = op !== null && op === liveOp;
      const fresh = op !== null && live.length === 0 && op.p.length <= 2;
      if (op && settings && rect.size && liveRegion && (growing || fresh)) {
        const from = growing ? Math.max(0, liveSeen - 6) : 0;
        liveRegion.push(...strokeBoxes(op, from, faceTransform(settings.shape, rect.size)));
      } else {
        liveRegion = null;
      }
      liveOp = op;
      liveSeen = op ? op.p.length : 0;
      live = next;
      dirty.live = true;
      schedule();
    },
    setPreview(next: StampOp | null) {
      preview = next;
      schedule();
    },
    setTarget(next: { lit: boolean; dark: boolean }) {
      target = next;
      schedule();
    },
    setTheme(next: ThemeColors) {
      theme = next;
      schedule();
    },
    setReducedMotion(next: boolean) {
      reduced = next;
      schedule();
    },
    resize(width: number, height: number, ratio: number) {
      dpr = ratio;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      rect = plateRect(canvas.width, canvas.height, ratio, MAX_PLATE_PX);
      layoutView();
      schedule();
    },
    /** CSS px of canvas covered from below (the mobile controls sheet). */
    setBottomInset(px: number) {
      inset = { ...inset, target: Math.max(0, px) };
      schedule();
    },
    /** CSS px relative to the canvas → face units. */
    toFace(x: number, y: number) {
      if (!settings || !rect.size) return null;
      return screenToFace(faceTransform(settings.shape, rect.size), view, x * dpr, y * dpr);
    },
    async exportPng(): Promise<Blob | null> {
      if (!settings) return null;
      // Separate plates at export size; the live ones are untouched.
      const exportPlates = renderPlates(settings, EXPORT_PLATE_PX);
      return renderPng(exportPlates, settings, ops, theme, { dark: anim.dark, flame: anim.flame });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer?.dispose();
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
