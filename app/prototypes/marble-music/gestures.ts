// Multi-touch gesture logic: tap to drop, drag bars/emitters, knob or two-finger
// twist to rotate and stretch (retune). No DOM: the host supplies hit-testing and actions.

import { GEOMETRY } from "./data";
import { clamp, degreeForLength, lengthForDegree, snapAngle, toNormX, toPxX } from "./geometry";
import type { Bar, Size } from "./types";

export type Target =
  | { kind: "empty" }
  | { kind: "bar"; id: string }
  | { kind: "rotate"; id: string }
  | { kind: "remove"; id: string }
  | { kind: "emitter"; index: number };

export interface GestureHost {
  size(): Size;
  hit(x: number, y: number): Target;
  bar(id: string): Bar | undefined;
  emitter(index: number): { x: number; y: number } | undefined;
  dropMarble(x: number, y: number): void;
  select(id: string | null): void;
  pluck(id: string, velocity: number): void;
  updateBar(id: string, patch: Partial<Omit<Bar, "id">>): void;
  moveEmitter(index: number, x: number, y: number): void;
  removeBar(id: string): void;
  setTuning(id: string | null): void;
  commit(): void;
}

type Twist = {
  kind: "twist";
  id: string;
  a: number;
  b: number;
  angle0: number;
  length0: number;
  vecAngle0: number;
  dist0: number;
  mid0: { x: number; y: number };
  center0: { x: number; y: number };
};

type Gesture =
  | { kind: "empty" }
  | { kind: "bar"; id: string; offX: number; offY: number; moved: boolean }
  | { kind: "rotate"; id: string }
  | { kind: "remove"; id: string }
  | { kind: "emitter"; index: number; offX: number; offY: number }
  | Twist;

type Pointer = { x: number; y: number; sx: number; sy: number; g: Gesture };

/** Movement (px) before a press on a bar counts as a drag. */
const DRAG_SLOP = 4;

export class Gestures {
  private pointers = new Map<number, Pointer>();

  constructor(private host: GestureHost) {}

  get active() {
    return this.pointers.size > 0;
  }

  /** Which knob is being dragged (for drawing it highlighted). */
  get rotating() {
    for (const p of this.pointers.values()) if (p.g.kind === "rotate" || p.g.kind === "twist") return true;
    return false;
  }

  down(pid: number, x: number, y: number) {
    const host = this.host;
    const size = host.size();
    const target = host.hit(x, y);
    let g: Gesture;

    if (target.kind === "empty") {
      // A second finger while dragging a bar twists/stretches that bar instead of dropping.
      const drag = [...this.pointers.entries()].find(([, p]) => p.g.kind === "bar");
      if (drag) {
        const [aid, pa] = drag;
        const bar = host.bar((pa.g as { id: string }).id);
        if (bar) {
          const twist: Twist = {
            kind: "twist",
            id: bar.id,
            a: aid,
            b: pid,
            angle0: bar.angle,
            length0: lengthForDegree(bar.degree, size),
            vecAngle0: Math.atan2(y - pa.y, x - pa.x),
            dist0: Math.max(24, Math.hypot(x - pa.x, y - pa.y)),
            mid0: { x: (x + pa.x) / 2, y: (y + pa.y) / 2 },
            center0: { x: toPxX(bar.x, size), y: bar.y * size.height },
          };
          pa.g = twist;
          this.pointers.set(pid, { x, y, sx: x, sy: y, g: twist });
          host.setTuning(bar.id);
          return;
        }
      }
      host.select(null);
      host.dropMarble(x, y);
      g = { kind: "empty" };
    } else if (target.kind === "bar") {
      const bar = host.bar(target.id)!;
      host.select(bar.id);
      host.pluck(bar.id, 0.55);
      g = { kind: "bar", id: bar.id, offX: x - toPxX(bar.x, size), offY: y - bar.y * size.height, moved: false };
    } else if (target.kind === "rotate") {
      host.setTuning(target.id);
      g = { kind: "rotate", id: target.id };
    } else if (target.kind === "remove") {
      g = { kind: "remove", id: target.id };
    } else {
      const em = host.emitter(target.index)!;
      g = { kind: "emitter", index: target.index, offX: x - toPxX(em.x, size), offY: y - em.y * size.height };
    }
    this.pointers.set(pid, { x, y, sx: x, sy: y, g });
  }

  move(pid: number, x: number, y: number) {
    const p = this.pointers.get(pid);
    if (!p) return;
    p.x = x;
    p.y = y;
    const host = this.host;
    const size = host.size();
    const g = p.g;

    if (g.kind === "bar") {
      if (!g.moved && Math.hypot(x - p.sx, y - p.sy) < DRAG_SLOP) return;
      g.moved = true;
      host.updateBar(g.id, {
        x: clamp(toNormX(x - g.offX, size), 0.02, 0.98),
        y: clamp((y - g.offY) / size.height, 0.02, 0.98),
      });
    } else if (g.kind === "rotate") {
      const bar = host.bar(g.id);
      if (!bar) return;
      const cx = toPxX(bar.x, size);
      const cy = bar.y * size.height;
      const reach = Math.hypot(x - cx, y - cy) - GEOMETRY.knobGap - GEOMETRY.knobRadius * 0.4;
      this.retune(bar, snapAngle(Math.atan2(y - cy, x - cx)), reach * 2, size);
    } else if (g.kind === "twist") {
      const pa = this.pointers.get(g.a);
      const pb = this.pointers.get(g.b);
      const bar = host.bar(g.id);
      if (!pa || !pb || !bar) return;
      const vx = pb.x - pa.x;
      const vy = pb.y - pa.y;
      const angle = snapAngle(g.angle0 + Math.atan2(vy, vx) - g.vecAngle0);
      const midX = (pa.x + pb.x) / 2;
      const midY = (pa.y + pb.y) / 2;
      host.updateBar(g.id, {
        x: clamp(toNormX(g.center0.x + midX - g.mid0.x, size), 0.02, 0.98),
        y: clamp((g.center0.y + midY - g.mid0.y) / size.height, 0.02, 0.98),
      });
      this.retune(bar, angle, g.length0 * (Math.hypot(vx, vy) / g.dist0), size);
    } else if (g.kind === "emitter") {
      host.moveEmitter(
        g.index,
        clamp(toNormX(x - g.offX, size), 0.04, 0.96),
        clamp((y - g.offY) / size.height, 0.03, 0.9)
      );
    }
  }

  /** Angle + length → snapped degree. Plays the new note when the pitch changes. */
  private retune(bar: Bar, angle: number, length: number, size: Size) {
    const degree = degreeForLength(length, size);
    const changed = degree !== bar.degree;
    this.host.updateBar(bar.id, { angle, degree });
    if (changed) this.host.pluck(bar.id, 0.45);
  }

  up(pid: number, cancelled = false) {
    const p = this.pointers.get(pid);
    if (!p) return;
    this.pointers.delete(pid);
    const host = this.host;
    const g = p.g;

    if (g.kind === "bar" && g.moved) host.commit();
    else if (g.kind === "rotate") {
      host.setTuning(null);
      host.commit();
    } else if (g.kind === "emitter") host.commit();
    else if (g.kind === "remove" && !cancelled) {
      const t = host.hit(p.x, p.y);
      if (t.kind === "remove" && t.id === g.id) host.removeBar(g.id);
    } else if (g.kind === "twist") {
      // Fall back to a one-finger drag with whichever finger is still down.
      const otherId = pid === g.a ? g.b : g.a;
      const other = this.pointers.get(otherId);
      const bar = host.bar(g.id);
      const size = host.size();
      if (other && bar) {
        other.g = {
          kind: "bar",
          id: bar.id,
          offX: other.x - toPxX(bar.x, size),
          offY: other.y - bar.y * size.height,
          moved: true,
        };
      }
      host.setTuning(null);
      host.commit();
    }
  }

  cancelAll() {
    for (const pid of [...this.pointers.keys()]) this.up(pid, true);
  }
}
