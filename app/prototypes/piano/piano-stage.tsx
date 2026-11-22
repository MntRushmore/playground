"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { PianoAudio } from "./audio-engine";
import { keyColor } from "./colors";
import { FAB_CLEARANCE } from "./data";
import { buildKeyboard, noteRange } from "./keyboard-layout";
import { panFor } from "./music";
import { spawnParticle } from "./particles";
import { PianoRow } from "./piano-row";
import { StageTint } from "./stage-tint";
import type { PianoSettings } from "./types";
import { useElementSize } from "./use-element-size";
import { useIsDark } from "./use-is-dark";
import { type PressPoint, usePianoInput } from "./use-piano-input";

const ROW_GAP = 12;

export function PianoStage({
  settings,
  audio,
  ready,
}: {
  settings: PianoSettings;
  audio: PianoAudio;
  /** Persisted settings loaded: render keys only then, so the entrance plays once. */
  ready: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);
  const area = useElementSize(surfaceRef);
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const dark = useIsDark();

  const { octaves, startOctave, blackKeys, theme, labels } = settings;
  const { lowest, highest } = noteRange(octaves, startOctave);

  const layout = useMemo(
    () => buildKeyboard({ octaves, startOctave, blackKeys, area, rowGap: ROW_GAP }),
    [octaves, startOctave, blackKeys, area]
  );

  // Press bookkeeping: press id (finger / computer key) → note; a note stays lit while any press holds it.
  const pressesRef = useRef(new Map<string, number>());
  const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set());
  const [lastMidi, setLastMidi] = useState<number | null>(null);
  const syncPressed = () => setPressed(new Set(pressesRef.current.values()));

  const onPress = (id: string, midi: number, key: HTMLElement | null, point: PressPoint | null) => {
    audio.noteOn(id, midi, panFor(midi, lowest, highest));
    pressesRef.current.set(id, midi);
    syncPressed();
    setLastMidi(midi);

    const layer = particlesRef.current;
    if (reducedMotion || !layer || !key) return;
    const box = layer.getBoundingClientRect();
    const rect = key.getBoundingClientRect();
    const x = (point?.x ?? rect.left + rect.width / 2) - box.left;
    const y = (point?.y ?? rect.top + rect.height * 0.7) - box.top;
    const color = keyColor(theme, midi, dark);
    spawnParticle(layer, x, y, color);
    if (Math.random() < 0.35) spawnParticle(layer, x, y, color);
  };

  const onRelease = (id: string) => {
    audio.noteOff(id);
    if (pressesRef.current.delete(id)) syncPressed();
  };

  const unlock = useCallback(() => audio.unlock(), [audio]);

  // Expose the AudioContext state on the stage (handy for checking audio really started).
  useEffect(
    () =>
      audio.listen((state) => {
        if (stageRef.current) stageRef.current.dataset.audio = state;
      }),
    [audio]
  );
  usePianoInput(surfaceRef, { lowest, highest, blackKeys, onPress, onRelease, onGesture: unlock });

  // Keep the floating controls button (phones) off the keys: below them in portrait, beside them in landscape.
  const portrait = stage.height >= stage.width;
  const edge = isMobile ? "0.5rem" : "0.75rem";
  const padding = {
    paddingTop: edge,
    paddingLeft: `max(${edge}, env(safe-area-inset-left))`,
    paddingRight:
      isMobile && !portrait ? `${FAB_CLEARANCE.side}px` : `max(${edge}, env(safe-area-inset-right))`,
    paddingBottom:
      isMobile && portrait
        ? `max(${FAB_CLEARANCE.bottom}px, calc(env(safe-area-inset-bottom) + 56px))`
        : `max(${edge}, env(safe-area-inset-bottom))`,
  };

  const measured = area.width > 0 && area.height > 0;
  const whiteWidth = layout.rows[0] ? area.width / layout.rows[0].whiteCount : 0;
  const fontSize = Math.round(Math.min(22, Math.max(14, whiteWidth * 0.32)));

  return (
    <div
      ref={stageRef}
      className="relative min-h-0 flex-1 touch-none overflow-hidden bg-background select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
    >
      <StageTint theme={theme} midi={lastMidi} dark={dark} />
      <div
        ref={surfaceRef}
        role="group"
        aria-label="Piano keys"
        className="absolute inset-0 flex flex-col"
        style={{ ...padding, gap: ROW_GAP }}
      >
        {ready &&
          measured &&
          layout.rows.map((row, i) => (
            <PianoRow
              key={`${row.id}:${blackKeys}`}
              row={row}
              rowIndex={i}
              theme={theme}
              dark={dark}
              labels={labels}
              pressed={pressed}
              fontSize={fontSize}
            />
          ))}
      </div>
      <div ref={particlesRef} aria-hidden className="pointer-events-none absolute inset-0" />
    </div>
  );
}
