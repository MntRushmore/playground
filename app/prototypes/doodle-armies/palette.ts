// Palette. Team colors and the ink/paper feel are SUBJECT CONTENT (like the
// piano-key colors), so hex lives here by design. Each team has a light- and a
// dark-theme ink so doodles stay legible on paper (light) and chalkboard (dark).
// UI chrome elsewhere uses design tokens only.

import type { Team, ThemeInk } from "./types";

type Ink = { ink: string; wash: string };

const TEAM: Record<Team, { light: Ink; dark: Ink }> = {
  blue: {
    light: { ink: "#27428c", wash: "#6f93de" },
    dark: { ink: "#7fb0ff", wash: "#3f63b4" },
  },
  red: {
    light: { ink: "#b13024", wash: "#d9776b" },
    dark: { ink: "#ff8373", wash: "#b24a3c" },
  },
};

const HEAL = { light: "#2f8f4e", dark: "#69d98a" };

/** Dark ink line color for a team in the current theme. */
export function teamInk(team: Team, dark: boolean): string {
  return TEAM[team][dark ? "dark" : "light"].ink;
}

/** Softer fill/wash color for a team (used for body fills and home tints). */
export function teamWash(team: Team, dark: boolean): string {
  return TEAM[team][dark ? "dark" : "light"].wash;
}

export function healInk(dark: boolean): string {
  return HEAL[dark ? "dark" : "light"];
}

/** A single vivid team color for small UI chips/dots (reads on both themes). */
export function teamSwatch(team: Team): string {
  return team === "blue" ? "#3b5bd9" : "#dc3a2e";
}

/** Hex (#rrggbb) → rgba() string with the given alpha. */
export function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Read the paper/ink design tokens from the DOM (canvas can't use classes). */
export function readThemeInk(el: HTMLElement, resolvedTheme: string | undefined): ThemeInk {
  const css = getComputedStyle(el);
  return {
    background: css.getPropertyValue("--background").trim() || "Canvas",
    foreground: css.getPropertyValue("--foreground").trim() || "CanvasText",
    dark: resolvedTheme !== "light",
  };
}
