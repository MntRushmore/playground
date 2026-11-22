"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";
import { midiForKeyCode } from "./music";

/** Hit-test step (px) when a finger moves fast: no key gets skipped in a glissando. */
const STEP_PX = 10;
/** Focus targets where letters mean typing, not playing. */
const TYPING = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"]';

export type PressPoint = { x: number; y: number };

type Options = {
  lowest: number;
  highest: number;
  blackKeys: boolean;
  onPress: (pressId: string, midi: number, key: HTMLElement | null, point: PressPoint | null) => void;
  onRelease: (pressId: string) => void;
  /** Any user gesture: used to unlock audio (touch only "activates" the page on pointerup). */
  onGesture: () => void;
};

/**
 * Multi-touch + glissando + computer keyboard for the key surface.
 * Every pointer is tracked on its own; moving onto another key releases the old one
 * and presses the new one. Keys are found with elementFromPoint, so implicit touch
 * capture doesn't matter.
 */
export function usePianoInput(surfaceRef: RefObject<HTMLElement | null>, options: Options) {
  const press = useEffectEvent(options.onPress);
  const release = useEffectEvent(options.onRelease);
  const gesture = useEffectEvent(options.onGesture);
  const midiFor = useEffectEvent((code: string) =>
    midiForKeyCode(code, options.lowest, options.highest, options.blackKeys)
  );

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    type Track = { key: string | null; x: number; y: number };
    const pointers = new Map<number, Track>();
    const keys = new Set<string>();
    const pid = (id: number) => `p${id}`;

    const keyAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-midi]");
      return el && surface.contains(el) ? el : null;
    };

    const moveTo = (id: number, track: Track, x: number, y: number) => {
      const el = keyAt(x, y);
      const next = el?.dataset.key ?? null;
      track.x = x;
      track.y = y;
      if (next === track.key) return;
      if (track.key) release(pid(id));
      track.key = next;
      if (el && next) press(pid(id), Number(el.dataset.midi), el, { x, y });
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      gesture();
      const track: Track = { key: null, x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, track);
      moveTo(e.pointerId, track, e.clientX, e.clientY);
    };

    const onMove = (e: PointerEvent) => {
      const track = pointers.get(e.pointerId);
      if (!track) return;
      const points = e.getCoalescedEvents?.() ?? [];
      for (const p of points.length ? points : [e]) {
        // Walk the segment so a quick swipe still sounds every key it crosses.
        const dx = p.clientX - track.x;
        const dy = p.clientY - track.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / STEP_PX));
        const x0 = track.x;
        const y0 = track.y;
        for (let i = 1; i <= steps; i++) {
          moveTo(e.pointerId, track, x0 + (dx * i) / steps, y0 + (dy * i) / steps);
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      const track = pointers.get(e.pointerId);
      if (!track) return;
      if (track.key) release(pid(e.pointerId));
      pointers.delete(e.pointerId);
      gesture();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(TYPING)) return;
      const midi = midiFor(e.code);
      if (midi === null || keys.has(e.code)) return;
      e.preventDefault();
      gesture();
      keys.add(e.code);
      press(`k${e.code}`, midi, surface.querySelector<HTMLElement>(`[data-midi="${midi}"]`), null);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!keys.delete(e.code)) return;
      release(`k${e.code}`);
    };

    const releaseAll = () => {
      for (const [id, track] of pointers) if (track.key) release(pid(id));
      for (const code of keys) release(`k${code}`);
      pointers.clear();
      keys.clear();
    };
    const onVisibility = () => document.hidden && releaseAll();
    const noMenu = (e: Event) => e.preventDefault();

    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("contextmenu", noMenu);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      releaseAll();
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("contextmenu", noMenu);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [surfaceRef]);
}
