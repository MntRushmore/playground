"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ControlSchema,
  type ControlValues,
  getDefaults,
  randomizeValues,
  sanitizeValues,
} from "@/lib/controls/schema";
import { readStorage, writeStorage } from "@/lib/storage";

export type ControlsApi<S extends ControlSchema> = {
  schema: S;
  values: ControlValues<S>;
  set: <K extends keyof S>(key: K, value: ControlValues<S>[K]) => void;
  reset: () => void;
  randomize: () => void;
  /** False until persisted values have been read on mount. */
  loaded: boolean;
};

/**
 * State for a control panel. Persists to localStorage (`pg:<slug>:controls`),
 * loads on mount, and validates stored values against the schema.
 */
export function useControls<S extends ControlSchema>(slug: string, schema: S): ControlsApi<S> {
  const defaults = useMemo(() => getDefaults(schema), [schema]);
  const [values, setValues] = useState<ControlValues<S>>(defaults);
  const [loaded, setLoaded] = useState(false);
  const schemaRef = useRef(schema);

  useEffect(() => {
    setValues(sanitizeValues(schemaRef.current, readStorage(slug, "controls", null)));
    setLoaded(true);
  }, [slug]);

  const commit = useCallback(
    (next: ControlValues<S>) => {
      setValues(next);
      writeStorage(slug, "controls", next);
    },
    [slug]
  );

  const set = useCallback<ControlsApi<S>["set"]>(
    (key, value) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        writeStorage(slug, "controls", next);
        return next;
      });
    },
    [slug]
  );

  const reset = useCallback(() => commit(defaults), [commit, defaults]);
  const randomize = useCallback(
    () => setValues((prev) => {
      const next = randomizeValues(schema, prev);
      writeStorage(slug, "controls", next);
      return next;
    }),
    [schema, slug]
  );

  return { schema, values, set, reset, randomize, loaded };
}
