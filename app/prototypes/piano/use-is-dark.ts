"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * True for the dark theme (the default). Reports dark on the server and during
 * hydration so the markup matches, then follows the real theme.
 */
export function useIsDark() {
  const { resolvedTheme } = useTheme();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  return hydrated ? resolvedTheme !== "light" : true;
}
