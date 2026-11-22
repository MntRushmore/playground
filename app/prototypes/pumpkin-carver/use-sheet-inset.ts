"use client";

import { type RefObject, useEffect } from "react";

const SHEET = '[data-slot="drawer-content"]';
/** Keep measuring this long after a change, to follow the sheet's open/close transition. */
const FOLLOW_MS = 700;

/**
 * Reports how many CSS px of `ref` the mobile controls sheet covers, so the pumpkin can
 * slide up and stay visible while you tweak it. Watches the DOM instead of needing a
 * hook into the shared ControlsLayout.
 */
export function useSheetInset(ref: RefObject<HTMLElement | null>, onInset: (px: number) => void) {
  useEffect(() => {
    let raf = 0;
    let until = 0;
    let last = -1;

    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const sheet = document.querySelector(SHEET);
      const box = el.getBoundingClientRect();
      let inset = 0;
      if (sheet && sheet.getAttribute("data-state") !== "closed") {
        const top = sheet.getBoundingClientRect().top;
        inset = Math.max(0, Math.min(box.height, box.bottom - top));
      }
      if (Math.abs(inset - last) > 0.5) {
        last = inset;
        onInset(inset);
      }
      if (performance.now() < until) raf = requestAnimationFrame(measure);
    };

    const follow = () => {
      until = performance.now() + FOLLOW_MS;
      if (!raf) raf = requestAnimationFrame(measure);
    };

    const observer = new MutationObserver(follow);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "style"],
    });
    window.addEventListener("resize", follow);
    follow();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", follow);
      cancelAnimationFrame(raf);
    };
  }, [ref, onInset]);
}
