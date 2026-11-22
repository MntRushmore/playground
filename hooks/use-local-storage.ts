"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/storage";

/**
 * useState that persists to localStorage under `pg:<slug>:<key>`.
 * Renders `initial` on the server and first client render, then loads on mount.
 * `loaded` is false until the stored value has been read.
 */
export function useLocalStorage<T>(slug: string, key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    setValue(readStorage(slug, key, initialRef.current));
    setLoaded(true);
  }, [slug, key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeStorage(slug, key, resolved);
        return resolved;
      });
    },
    [slug, key]
  );

  return [value, set, loaded] as const;
}
