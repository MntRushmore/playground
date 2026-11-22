"use client";

import { keyColor } from "./colors";
import { noteLabel } from "./music";
import { PianoKey } from "./piano-key";
import type { LabelMode, RowLayout, ThemeId } from "./types";

/** One do-to-do row of keys. White keys first so black keys paint on top. */
export function PianoRow({
  row,
  rowIndex,
  theme,
  dark,
  labels,
  pressed,
  fontSize,
}: {
  row: RowLayout;
  rowIndex: number;
  theme: ThemeId;
  dark: boolean;
  labels: LabelMode;
  pressed: ReadonlySet<number>;
  fontSize: number;
}) {
  return (
    <div className="relative min-h-0 flex-1">
      {row.keys.map((k) => {
        // Left-to-right wave, each row starting a beat after the one above.
        const order = rowIndex * 3 + (k.left / 100) * row.whiteCount;
        return (
          <PianoKey
            key={k.id}
            layout={k}
            color={keyColor(theme, k.midi, dark)}
            label={noteLabel(k.midi, labels)}
            pressed={pressed.has(k.midi)}
            order={order}
            fontSize={fontSize}
          />
        );
      })}
    </div>
  );
}
