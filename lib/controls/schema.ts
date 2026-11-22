// Control-panel schema: pure, React-free. Define knobs once and get typed values,
// defaults, sanitizing (for persisted data) and Randomize for free.
//
//   export const controls = defineControls({
//     speed: { type: "number", label: "Speed", min: 0, max: 5, step: 0.1, default: 1 },
//     trails: { type: "boolean", label: "Trails", default: true },
//     shape: { type: "select", label: "Shape", options: ["circle", "square"], default: "circle" },
//     tint: { type: "color", label: "Tint", default: "#7c3aed" },
//   });
//   type Settings = ControlValues<typeof controls>; // { speed: number; trails: boolean; shape: "circle" | "square"; tint: string }

type ControlBase = {
  label: string;
  /** Exclude from Randomize. Default: included. */
  randomize?: boolean;
  /**
   * Show this control only when the predicate is true (progressive disclosure),
   * e.g. `when: (v) => v.palette === "tint"`. It animates open/closed.
   */
  when?: (values: Record<string, unknown>) => boolean;
};

export type NumberControl = ControlBase & {
  type: "number";
  min: number;
  max: number;
  step?: number;
  default: number;
  /** Optional value suffix/formatter shown next to the label, e.g. (v) => `${v}px`. */
  format?: (value: number) => string;
  /** Restrict Randomize to a narrower range than min/max. */
  randomRange?: [number, number];
};

export type BooleanControl = ControlBase & {
  type: "boolean";
  default: boolean;
};

export type SelectControl<T extends string = string> = ControlBase & {
  type: "select";
  options: readonly T[];
  /** Optional display labels per option. */
  optionLabels?: Partial<Record<T, string>>;
  default: T;
};

/**
 * A user-chosen color (hex). This is content the user tunes, e.g. a particle tint.
 * UI chrome must still use design tokens.
 */
export type ColorControl = ControlBase & {
  type: "color";
  default: string;
};

export type Control = NumberControl | BooleanControl | SelectControl | ColorControl;
export type ControlSchema = Record<string, Control>;

export type ControlValues<S extends ControlSchema> = {
  [K in keyof S]: S[K] extends NumberControl
    ? number
    : S[K] extends BooleanControl
      ? boolean
      : S[K] extends SelectControl<infer T>
        ? T
        : string;
};

/** Identity helper that preserves literal types (select options). */
export function defineControls<const S extends ControlSchema>(schema: S): S {
  return schema;
}

export function getDefaults<S extends ControlSchema>(schema: S): ControlValues<S> {
  const out: Record<string, unknown> = {};
  for (const [key, c] of Object.entries(schema)) out[key] = c.default;
  return out as ControlValues<S>;
}

function decimals(step: number) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

export function clampToStep(c: NumberControl, value: number) {
  const step = c.step ?? (c.max - c.min) / 100;
  const snapped = Math.round((value - c.min) / step) * step + c.min;
  const clamped = Math.min(c.max, Math.max(c.min, snapped));
  return Number(clamped.toFixed(decimals(step)));
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function randomValue(c: Control, rand: () => number): unknown {
  switch (c.type) {
    case "number": {
      const [lo, hi] = c.randomRange ?? [c.min, c.max];
      return clampToStep(c, lo + rand() * (hi - lo));
    }
    case "boolean":
      return rand() < 0.5;
    case "select":
      return c.options[Math.floor(rand() * c.options.length)] ?? c.default;
    case "color":
      // Pleasant, saturated colors that read on both light and dark backgrounds.
      return hslToHex(rand() * 360, 0.65 + rand() * 0.25, 0.5 + rand() * 0.12);
  }
}

/** New values with every randomizable control re-rolled. */
export function randomizeValues<S extends ControlSchema>(
  schema: S,
  current: ControlValues<S>,
  rand: () => number = Math.random
): ControlValues<S> {
  const out: Record<string, unknown> = { ...current };
  for (const [key, c] of Object.entries(schema)) {
    if (c.randomize === false) continue;
    out[key] = randomValue(c, rand);
  }
  return out as ControlValues<S>;
}

/** Validate untrusted (persisted) values against the schema, falling back to defaults. */
export function sanitizeValues<S extends ControlSchema>(schema: S, input: unknown): ControlValues<S> {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, c] of Object.entries(schema)) {
    const v = src[key];
    switch (c.type) {
      case "number":
        out[key] = typeof v === "number" && Number.isFinite(v) ? clampToStep(c, v) : c.default;
        break;
      case "boolean":
        out[key] = typeof v === "boolean" ? v : c.default;
        break;
      case "select":
        out[key] = typeof v === "string" && c.options.includes(v) ? v : c.default;
        break;
      case "color":
        out[key] = typeof v === "string" && HEX_RE.test(v) ? v : c.default;
        break;
    }
  }
  return out as ControlValues<S>;
}
