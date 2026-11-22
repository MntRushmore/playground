// Keyboard layout: which notes go in which row, and where each key sits. Pure.

import { BLACK_KEY, BLACK_OFFSETS, MIN_KEY_WIDTH, TARGET_KEY_ASPECT } from "./data";
import { cOf, isBlack, pitchClass } from "./music";
import type { KeyboardLayout, KeyLayout, RowLayout, Size } from "./types";

export type LayoutInput = {
  octaves: number;
  startOctave: number;
  blackKeys: boolean;
  /** Space for the keys, px. */
  area: Size;
  /** Gap between rows, px. */
  rowGap: number;
};

/** Lowest and highest notes on screen (the range always ends on a C). */
export function noteRange(octaves: number, startOctave: number) {
  const lowest = cOf(startOctave);
  return { lowest, highest: lowest + octaves * 12 };
}

/**
 * How badly `rows` rows fit the area: distance (in log space) from a chunky key shape,
 * plus a big penalty when keys get narrower than a small finger.
 */
export function rowScore(rows: number, octaves: number, area: Size, rowGap: number) {
  const whites = (octaves / rows) * 7 + 1;
  const keyWidth = area.width / whites;
  const rowHeight = (area.height - rowGap * (rows - 1)) / rows;
  if (rowHeight <= 0 || keyWidth <= 0) return Infinity;
  const shape = Math.abs(Math.log(rowHeight / keyWidth / TARGET_KEY_ASPECT));
  const narrow = keyWidth < MIN_KEY_WIDTH ? 3 + (MIN_KEY_WIDTH - keyWidth) / 10 : 0;
  return shape + narrow;
}

/** Rows split the range at octave boundaries, so every row is a full do-to-do scale. */
export function chooseRowCount(octaves: number, area: Size, rowGap: number) {
  let best = 1;
  let bestScore = Infinity;
  for (let rows = 1; rows <= octaves; rows++) {
    if (octaves % rows !== 0) continue;
    const score = rowScore(rows, octaves, area, rowGap);
    if (score < bestScore - 0.05) {
      best = rows;
      bestScore = score;
    }
  }
  return best;
}

function buildRow(index: number, low: number, high: number, blackKeys: boolean, area: Size, rowHeight: number): RowLayout {
  const whites: number[] = [];
  for (let m = low; m <= high; m++) if (!isBlack(m)) whites.push(m);
  const n = whites.length;
  const unit = 100 / n;
  const whitePx = area.width / n;
  const blackWidth = (whitePx < BLACK_KEY.narrowBelowPx ? BLACK_KEY.narrowWidth : BLACK_KEY.width) * unit;
  const blackHeight =
    100 *
    Math.min(BLACK_KEY.height, Math.max(BLACK_KEY.minHeight, (whitePx * BLACK_KEY.maxAspect) / rowHeight));

  const keys: KeyLayout[] = whites.map((midi, i) => ({
    id: `${index}-${midi}`,
    midi,
    black: false,
    left: i * unit,
    width: unit,
    height: 100,
  }));

  if (blackKeys) {
    whites.forEach((white, i) => {
      const midi = white + 1;
      if (!isBlack(midi) || midi > high) return;
      const center = (i + 1 + (BLACK_OFFSETS[pitchClass(midi)] ?? 0)) * unit;
      keys.push({
        id: `${index}-${midi}`,
        midi,
        black: true,
        left: center - blackWidth / 2,
        width: blackWidth,
        height: blackHeight,
      });
    });
  }

  return { id: `${index}:${low}-${high}`, keys, whiteCount: n };
}

/** Rows ordered top to bottom: higher notes on top, like climbing up. */
export function buildKeyboard(input: LayoutInput): KeyboardLayout {
  const { octaves, startOctave, blackKeys, area, rowGap } = input;
  const { lowest } = noteRange(octaves, startOctave);
  const rowCount = chooseRowCount(octaves, area, rowGap);
  const span = (octaves / rowCount) * 12;
  const rowHeight = Math.max(1, (area.height - rowGap * (rowCount - 1)) / rowCount);
  const rows: RowLayout[] = [];
  for (let r = rowCount - 1; r >= 0; r--) {
    const low = lowest + r * span;
    rows.push(buildRow(r, low, low + span, blackKeys, area, rowHeight));
  }
  return { rows };
}
