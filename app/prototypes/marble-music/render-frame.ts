// Draws one frame of the machine from a read-only view of its state.

import { createBarFx, type Effects } from "./effects";
import { marbleRadius, toPxX } from "./geometry";
import type { MarbleWorld } from "./marble-world";
import { degreeToMidi, noteName } from "./music";
import { drawBar, drawHandles } from "./render-bars";
import { drawEffects, drawEmitter, drawMarble } from "./render-scene";
import type { Bar, BarFx, BarGeom, Layout, Settings, Size, ThemeColors } from "./types";

/** A removed bar fading out. */
export type Ghost = { bar: Bar; geom: BarGeom; life: number };

export type FrameView = {
  size: Size;
  dpr: number;
  theme: ThemeColors;
  settings: Settings;
  backdrop: HTMLCanvasElement | null;
  layout: Layout;
  geoms: Map<string, BarGeom>;
  fx: Map<string, BarFx>;
  ghosts: Ghost[];
  selected: string | null;
  tuning: string | null;
  rotating: boolean;
  world: MarbleWorld;
  effects: Effects;
  emitterAppear: number[];
  autoDrop: boolean;
  trails: boolean;
};

export function renderFrame(ctx: CanvasRenderingContext2D, v: FrameView) {
  const { width, height } = v.size;
  if (width <= 0) return;
  const theme = v.theme;
  const s = v.settings;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  if (v.backdrop) ctx.drawImage(v.backdrop, 0, 0, width, height);
  else {
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);
  }

  for (const gh of v.ghosts) {
    drawBar(ctx, gh.geom, createBarFx(0, 1), gh.bar.degree, theme, false, gh.life);
  }
  for (const b of v.layout.bars) {
    const g = v.geoms.get(b.id);
    const fx = v.fx.get(b.id);
    if (g && fx) drawBar(ctx, g, fx, b.degree, theme, b.id === v.selected);
  }

  const r = marbleRadius(v.size, s.marbleSize);
  v.layout.emitters.forEach((em, i) => {
    const progress = v.autoDrop ? 1 - Math.max(0, Math.min(1, v.world.clocks[i] / v.world.period(i, s))) : 0;
    const x = toPxX(em.x, v.size);
    drawEmitter(ctx, x, em.y * height, r, progress, v.world.pulses[i], v.emitterAppear[i], theme);
  });

  for (const m of v.world.marbles.values()) {
    const pos = v.world.position(m.id);
    if (pos) drawMarble(ctx, pos.x, pos.y, m, theme, v.trails);
  }
  drawEffects(ctx, v.effects, theme);

  if (v.selected) {
    const g = v.geoms.get(v.selected);
    const bar = v.layout.bars.find((b) => b.id === v.selected);
    if (g && bar) {
      const label = v.tuning === bar.id ? noteName(degreeToMidi(bar.degree, s)) : null;
      drawHandles(ctx, g, theme, v.rotating ? "rotate" : null, label, width, height);
    }
  }
}
