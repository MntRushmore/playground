# Marble Run

## What It Does
A plastic marble-run construction kit. Build a track from glossy pieces (tracks, curves, a spinning-dish funnel, a flip-flop switch, a spinner wheel, bumpers, springs, a chain lift, catch trays) and watch glass marbles roll, drop, spin and ride the lift back up so the run loops forever.

## Architecture
```
 useControls("marble-run", controls) ──► localStorage pg:marble-run:controls
 use-layout (external store) ─────────► localStorage pg:marble-run:layout {version, pieces}
        │ pieces, undo                         (sanitizeLayout on load, default run fallback)
        ▼
 MarbleRunApp ── ControlsLayout ─┬─ ControlPanel + TrackActions (side column / bottom sheet)
   │ selected, armed, running    └─ board area (@container)
   │                                 ├─ MarbleBoard (canvas)
   │                                 ├─ PieceToolbar (floating, selected piece)
   │                                 └─ tray: PiecePalette + RunControls
   ▼
 MarbleBoard ── requestAnimationFrame
   ├─ physics.stepSim(sim, dt, settings, running)            pure, Matter.js
   │    ├─ fixed 240 Hz sub-steps (time scale = more/fewer sub-steps)
   │    ├─ marbles.releaseMarbles / rollingContact            spawn, rolling without slipping
   │    ├─ kinematics.driveKinematics                         wheels, switch flips, lift cleats
   │    ├─ collisions (Matter events)                         springs, bumpers, cup, sound events
   │    └─ vortex.driveVortices                               funnel orbits (ω·r² conserved)
   ├─ sound.play(events) / setRolling                         Web Audio, rate-limited
   └─ render.drawFrame
        ├─ cached layers (rebuilt on layout/view/theme change):
        │    body: floor shadow, posts (posts.ts), piece bodies with soft shadows
        │    front: funnel walls      lip: translucent chute lips, tray fronts
        └─ live: moving parts (render-parts), marbles (render-marbles), overlay
 use-board-pointer ── tap / drag / rotate-handle gestures ──► layoutActions (commit + undo)
```

## Frontend
- **State**: layout lives in a small external store (`use-layout.ts`, read with `useSyncExternalStore`), so the server and hydration render the default run and the client then loads storage once. Every mutation pushes the previous layout onto an undo stack (60 deep) and persists `{version: 1, pieces}`. Stored data is validated piece by piece (type, finite numbers, clamped to the board, unique ids); anything unusable falls back to the default run. Control values persist through `useControls`.
- **World units**: the board is 1000 × 1250 units; pieces store `x, y, angle (deg), flip`. `fitView` scales it into the canvas, avoiding the tray (left rail when the board area is ≥720px wide, bottom band otherwise) and standing it on the bottom edge. Resizes and rotations just refit.
- **Physics** (Matter.js): fixed 240 Hz sub-steps keep 14-unit rails tunnel-proof at the 2800 u/s speed cap. Marbles are 64-sided polygons with solid-sphere inertia (I = 2/5·m·r²), and `rollingContact` pulls spin towards ω = (n × v_rel)/r while touching a surface, so marbles roll (not slide or wheel-spin) and visible spin matches travel. Moving parts are static bodies driven every sub-step *with* velocity (`setPosition/setAngle(..., true)`) so the solver carries marbles along. A guard stops solver explosions: without a spring/bumper kick, a marble can't exceed its previous speed (or the speed of a marble that hit it) by more than ~300 u/s.
- **Pieces**: track and curve (14-segment arc, overlapping round-capped segments so marbles never catch), funnel (upright funnels capture marbles into an orbit that speeds up as the radius shrinks, passing behind and in front of the translucent dish, then drop them out of the neck), switch (flip-flop that tips the other way once each marble has cleared it), wheel (motorised spinner), bumper (kick), spring (trampoline returning 82% of the incoming normal speed, launches scaled by √g so arcs keep their shape), lift (chain of cleats that rise, decelerate below 1g, tip and dwell, then return hidden), cup (sensor: celebration sparks, a soft-floor settle, marbles retire after 3.5 s), dropper (releases marbles at the release rate up to the marble cap).
- **Default run**: dropper → spinner wheel → top track → switch. Right: track → funnel → long track → lift → back to the top. Left: track → curve → track → spring hop into the cup, with a catch track under the hop. Loops forever; 4.5 s of physics is simulated instantly on first frame (with a faster release) so marbles are already everywhere.
- **Building**: tap a palette piece then tap the board, or drag it straight out of the tray (a ghost previews the drop). Drag pieces to move (grid snap optional, track ends click together via connectors, receiving end 3 units lower). Drag the round handle to rotate in 15° steps (angle readout), or use the toolbar: rotate ±15°, mirror (curve, switch, wheel, lift), duplicate, delete. Undo in the run controls. Tapping empty board drops a marble; tapping while something is selected deselects. Desktop shortcuts: R / Shift+R rotate, M mirror, D duplicate, Delete, Esc, ⌘/Ctrl+Z undo, Space play/pause.
- **Run controls**: Play/Pause (paused physics keeps marbles where they are while you edit), Reset marbles, Undo. "Default run" and "Clear track" (both undoable) sit under the control panel.
- **Rendering**: canvas 2.5D "molded plastic" with light from the top-left: stacked tube columns with alternating color bands and collars, glossy cylinder gradients, cone-cup dropper, translucent dish, catch tray whose front face hides the lower half of resting marbles, soft studio drop shadows (cached layers, so the per-frame cost is a few blits). Glass marbles have a cat's-eye vane that turns with the body, a fixed specular highlight, contact shadow and soft trails. Plastic and marble colors are content in `data.ts` and identical in both themes; the backdrop, editing grid and UI chrome come from theme tokens (`--background`, `--foreground`, resolved through a 1×1 canvas so oklch works).
- **Responsive**: palette is a horizontally scrolling icon row above the run controls on phones (labels from `sm:`), a labelled left rail in wide board areas. `touch-action: none` on the board; the tray scrolls with `pan-x`/`pan-y` and only pulls a piece out on a mostly-vertical drag.
- **Reduced motion**: starts paused with the warmed-up run frozen in place; Play is one tap away.
- **Tab hidden**: the animation loop stops on `visibilitychange` and resumes without a time jump.
- **Sound** (off by default): soft woody clacks for tracks, glassy ticks for marble-on-marble, boops for bumpers, a spring thwip, a small tink when a marble lands in the cup, and a quiet rolling rumble. Velocity-scaled, at most 3 per frame and ~22 per second. The AudioContext is created/resumed only inside pointer/key gestures.

## AI Usage
None.

## Key Dependencies
- `matter-js` (rigid-body physics; a few 0.20 internals such as `positionPrev`/`setAngle(…, updateVelocity)` are typed locally in `bodies.ts`)
- `@/components/controls` (panel, persistence, Randomize, Reset), `@/lib/storage`, `@/hooks/use-reduced-motion`
- `next-themes` (`resolvedTheme` to re-read tokens), shadcn `Button` / `Separator`, `lucide-react`
- Web Audio API (no Tone.js needed)

## Component Tree
```
MarbleRunPage (page.tsx, server)
└─ MarbleRunApp (client)
   └─ ControlsLayout
      ├─ board area
      │  ├─ MarbleBoard (canvas + useBoardPointer)
      │  ├─ PieceToolbar (when a piece is selected and not dragging)
      │  └─ tray
      │     ├─ PiecePalette → PieceIcon ×10
      │     └─ RunControls
      └─ panel
         ├─ ControlPanel
         └─ TrackActions
```

## Error Handling
- Missing 2D context: the board effect exits quietly.
- Corrupt, outdated (version ≠ 1) or partial stored layouts: invalid pieces are dropped, positions clamped, ids de-duplicated; an unusable layout falls back to the default run. Controls are sanitized by the shared schema.
- `localStorage` unavailable: nothing persists, everything else works.
- Physics safety nets: speed cap, anti-explosion guard, marbles that leave the board, sit still for 3.2 s, or exceed the marble cap fade out and are removed; the dropper only spawns when its mouth is clear.
- Audio unavailable or blocked: sound calls no-op until a gesture unlocks the context.

## File Structure
```
marble-run/
├─ page.tsx                thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ marble-run-app.tsx      composes controls, board, tray, toolbar; shortcuts; sound lifecycle
├─ marble-board.tsx        canvas, RAF loop, resize/theme, cached layers, imperative API
├─ use-board-pointer.ts    tap / drag / rotate gestures, live drag override, snapping
├─ use-layout.ts           layout store: pieces, undo, persistence, actions
├─ use-keyboard-shortcuts.ts
├─ piece-palette.tsx       tray of pieces (tap to arm, drag out)
├─ piece-icon.tsx          line icons per piece
├─ piece-toolbar.tsx       floating actions for the selected piece
├─ run-controls.tsx        play/pause, reset marbles, undo
├─ track-actions.tsx       default run / clear track (in the panel)
├─ types.ts                Piece, Settings, Marble, View, events…
├─ data.ts                 constants, plastic + marble palettes, control schema
├─ default-layout.ts       the pre-built looping run
├─ geometry.ts             piece shapes (shared by physics and rendering), connectors, hit areas
├─ transforms.ts           local ⇄ world transforms, hit testing, handle position
├─ board-layout.ts         layout validation, snapping (grid, angle, track ends), board fitting
├─ bodies.ts               Matter bodies for pieces, kinematic helpers, Matter internals typing
├─ physics.ts              sim state, piece sync, sub-stepping, lifetimes, warm-up
├─ marbles.ts              marble spawn/release/clear, rolling contact
├─ kinematics.ts           wheels, switch, lift cleats
├─ collisions.ts           spring, bumper, cup, switch arming, impact events
├─ vortex.ts               funnel orbits
├─ posts.ts                support columns generated from the layout
├─ plastic.ts              glossy plastic drawing primitives
├─ render.ts               frame composition, cached layers, editing overlay
├─ render-pieces.ts        static pieces (body / front / lip layers)
├─ render-parts.ts         moving parts
├─ render-marbles.ts       glass marbles, trails, sparks
├─ render-trace.ts         selection outline
├─ theme.ts                token colors → RGB, mixing
└─ sound.ts                Web Audio clacks, rumble, cup tink
```
