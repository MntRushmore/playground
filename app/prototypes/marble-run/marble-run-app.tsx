"use client";

import { useEffect, useRef, useState } from "react";
import { ControlPanel, ControlsLayout, useControls } from "@/components/controls";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ANGLE_SNAP, MIRRORABLE, SLUG, controls } from "./data";
import { MarbleBoard, type BoardApi } from "./marble-board";
import { PiecePalette } from "./piece-palette";
import { PieceToolbar } from "./piece-toolbar";
import { RunControls } from "./run-controls";
import { createSound } from "./sound";
import { TrackActions } from "./track-actions";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { layoutActions, useLayout } from "./use-layout";
import type { PieceType, View } from "./types";

const PILL = "rounded-[1.25rem] border border-border bg-background/80 p-1 shadow-sm backdrop-blur-md";

export function MarbleRunApp() {
  const c = useControls(SLUG, controls);
  const { pieces, canUndo } = useLayout();
  const reducedMotion = useReducedMotion();
  // Reduced motion: start paused (marbles already placed); the user can press Play.
  const [userRunning, setUserRunning] = useState<boolean | null>(null);
  const running = userRunning ?? !reducedMotion;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [armed, setArmed] = useState<PieceType | null>(null);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const board = useRef<BoardApi>(null);
  const [sound] = useState(createSound);

  const selected = pieces.find((p) => p.id === selectedId) ?? null;

  useEffect(() => sound.setEnabled(c.values.sound), [sound, c.values.sound]);
  useEffect(() => {
    // Browsers only allow audio after a gesture: unlock on any pointer press.
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
      sound.dispose();
    };
  }, [sound]);

  const place = (type: PieceType, x: number, y: number) => {
    const id = layoutActions.place(type, x, y);
    setArmed(null);
    if (id) setSelectedId(id);
  };
  const remove = () => {
    if (!selected) return;
    layoutActions.remove(selected.id);
    setSelectedId(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const id = layoutActions.duplicate(selected.id);
    if (id) setSelectedId(id);
  };
  const toggleRunning = () => setUserRunning(!running);

  useKeyboardShortcuts({
    onEscape: () => {
      setSelectedId(null);
      setArmed(null);
    },
    onDelete: remove,
    onRotate: (dir) => selected && layoutActions.rotate(selected.id, dir * ANGLE_SNAP),
    onMirror: () => selected && MIRRORABLE.has(selected.type) && layoutActions.flip(selected.id),
    onDuplicate: duplicate,
    onUndo: layoutActions.undo,
    onTogglePlay: toggleRunning,
  });

  const panel = (
    <>
      <ControlPanel controls={c} />
      <TrackActions
        onRestore={() => {
          setSelectedId(null);
          layoutActions.restoreDefault();
        }}
        onClear={() => {
          setSelectedId(null);
          layoutActions.clear();
          board.current?.clearMarbles();
        }}
      />
    </>
  );

  return (
    // Fixed to the viewport (below the 56px header) so the board always fits and the
    // desktop panel scrolls on its own.
    <ControlsLayout panel={panel} className="h-[calc(100dvh-3.5rem)] min-h-[30rem] flex-none">
      <div className="@container relative min-h-0 flex-1 overflow-hidden">
        <MarbleBoard
          apiRef={board}
          pieces={pieces}
          settings={c.values}
          running={running}
          selectedId={selected?.id ?? null}
          armed={armed}
          trayRef={trayRef}
          sound={sound}
          onViewChange={setView}
          onSelect={(id) => {
            setSelectedId(id);
            if (id) setArmed(null);
          }}
          onPlace={place}
          onCommit={(id, x, y, angle) => layoutActions.move(id, x, y, angle)}
          onDragChange={setDragging}
          onGesture={() => sound.unlock()}
        />
        {selected && view && !dragging && (
          <PieceToolbar
            piece={selected}
            view={view}
            onRotate={(d) => layoutActions.rotate(selected.id, d)}
            onFlip={() => layoutActions.flip(selected.id)}
            onDuplicate={duplicate}
            onDelete={remove}
          />
        )}
        <div
          ref={trayRef}
          className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 @min-[720px]:inset-x-auto @min-[720px]:top-4 @min-[720px]:bottom-auto @min-[720px]:left-4 @min-[720px]:max-h-[calc(100%-2rem)] @min-[720px]:w-44"
        >
          <div className={`${PILL} min-w-0 @min-[720px]:order-last @min-[720px]:min-h-0 @min-[720px]:overflow-y-auto`}>
            <PiecePalette
              armed={armed}
              onArm={(t) => {
                setArmed(t);
                if (t) setSelectedId(null);
              }}
              onDragPreview={(t, x, y) => board.current?.previewAt(t, x, y) ?? null}
              onDrop={place}
            />
          </div>
          <div className="flex pr-16 md:pr-0">
            <div className={`${PILL} @min-[720px]:w-full`}>
              <RunControls
                running={running}
                canUndo={canUndo}
                onToggle={toggleRunning}
                onResetMarbles={() => board.current?.clearMarbles()}
                onUndo={layoutActions.undo}
              />
            </div>
          </div>
        </div>
      </div>
    </ControlsLayout>
  );
}
