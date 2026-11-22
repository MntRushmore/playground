"use client";

import { useEffect, useRef } from "react";

type Handlers = {
  onEscape: () => void;
  onDelete: () => void;
  onRotate: (dir: 1 | -1) => void;
  onMirror: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onTogglePlay: () => void;
};

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  const role = target.getAttribute("role");
  return role === "slider" || role === "combobox" || role === "option";
}

/** Desktop shortcuts: Esc, Delete, R / Shift+R, M, D, ⌘/Ctrl+Z, Space. */
export function useKeyboardShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const h = ref.current;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "z" && !e.shiftKey) {
        e.preventDefault();
        h.onUndo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (key === "escape") h.onEscape();
      else if (key === "delete" || key === "backspace") h.onDelete();
      else if (key === "r") h.onRotate(e.shiftKey ? -1 : 1);
      else if (key === "m") h.onMirror();
      else if (key === "d") h.onDuplicate();
      else if (key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        h.onTogglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
