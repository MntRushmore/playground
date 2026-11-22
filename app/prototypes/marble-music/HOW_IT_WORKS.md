# Marble Music

## What It Does
A generative marble machine. Marbles fall from emitters and bounce down tuned bars, and each hit plays a note quantized to the chosen key and scale, so the machine composes as it runs. Tap to drop marbles. Drag, twist and stretch bars to rearrange and retune it.

## Architecture
```
 useControls("marble-music", controls) ──► localStorage pg:marble-music:controls
        │ values
        ▼
 MarbleMusicApp ──► ControlsLayout ──┬──► ControlPanel + "Default layout" (side on md+, sheet on mobile)
        │                            └──► MarbleCanvas ── pointer events ──┐
        │ useMarbleAudio (unlock on first gesture)                         ▼
        │                                     MarbleMachine (framework-free, owns RAF loop)
        │                                     ├─ Gestures       tap / drag / knob / two-finger twist (pure)
        │                                     ├─ hitTest        knobs → nearest bar → emitters (pure)
        │                                     ├─ MarbleWorld    emitter clocks, marbles, debounced strikes
        │                                     │    └─ physics.ts  Matter.js: static bars, side walls, circles
        │                                     ├─ effects.ts     ripples, sparks, bar glow + flex (pure)
        │                                     ├─ render-frame   backdrop → bars → emitters → marbles → fx → handles
        │                                     └─ arrangement    sanitize / random / place-new-bar (pure)
        │                                          │
        │   onNote({freq, velocity, pan, delay})   │ onLayoutChange(layout)
        ▼                                          ▼
 MarbleAudio (Web Audio)                    localStorage pg:marble-music:layout
 additive mallet voice ─► lowpass ─► pan ─► bus ─┬─► dry ─────────────┐
                                                 └─► HP ─► convolver ─┴─► compressor ─► master ─► out
```

## Frontend
- **Pitch model**: each bar has a scale *degree* (0–11). Its length follows the degree geometrically, like a real xylophone (short = high), and its color comes from a low-warm to high-cool palette (`DEGREE_HUES`, oklch, separate lightness per theme). `music.ts` maps degree → MIDI through the key, the scale and the instrument's register, so every note is in the scale.
- **Layout space**: bars and emitters are stored normalized to a centered *stage* (full height, width capped at 1.1× height) so a machine plays the same on a phone and a wide monitor. Sizes scale from the canvas's shorter side. The dot grid marks the stage.
- **Physics**: Matter.js at a fixed 120 Hz step with an accumulator (up to 8 substeps per frame). Gravity scales with canvas height. Marble speed is clamped so nothing tunnels through a thin bar. Marbles fade when still for 2.2 s or older than 40 s, and the oldest fades past 44 marbles.
- **Notes**: `collisionStart` fires before the solver runs, so the normal impact speed is the true pre-impact speed. Speed maps to velocity with a soft knee; velocity sets loudness, filter brightness and the level of the upper partials. Strikes are debounced per marble/bar pair (90 ms) and per bar (40 ms) so rattles never buzz. Each note is scheduled on the audio clock offset by its substep, which keeps timing inside a frame.
- **Audio**: raw Web Audio (no Tone.js). Additive voices with per-partial exponential decays, longer decays for lower notes, and a short band-passed noise "mallet" transient (marimba, kalimba, music box). At most 14 voices: the oldest is faded over 30 ms rather than cut. A procedural stereo impulse response feeds the reverb send, and a compressor sits before the master. Recorded output was checked with earshot: true peak −5.4 dBTP, −17.3 LUFS for marimba.
- **Start**: the machine runs silently from the first frame, warmed up with 3.2 s of simulated time so it opens mid-performance, and the thumbnail shows it moving. A "Tap for sound" pill sits where the toolbar goes. Any tap on the canvas, or the pill, unlocks audio, and the pill hands off to the toolbar.
- **Interaction** (pointer events, `touch-action: none`, pointer capture):
  - Tap empty space: drop a marble right there (on press, for instant response).
  - Tap a bar: select it and hear its note. Drag it to move it.
  - Rotate knob (circular arrow, past one end): drag to turn and stretch. Stretching snaps the length to the next degree, plays the new note and shows its name (e.g. "A4"). Angles snap to 15° steps within about 3°.
  - Second finger while dragging a bar: twist to rotate, pinch to retune, both fingers move it.
  - × knob (past the other end) removes the bar. Knobs stay on screen at the edges.
  - Drag an emitter to move it.
  - Toolbar: Pause/Play drops, Add bar (placed in the most open spot), New layout, Sound. Icon-only on phones and short landscape screens, labelled from `sm` when tall enough.
  - Keyboard: Space pauses or resumes drops, Delete/Backspace removes the selected bar, Escape deselects.
- **Emitters**: 1–3 emitters at a 2:3:4 drop-period ratio (a loose polyrhythm). Each ring fills until the next drop while the next marble "loads" in the middle. Wander jitters the drop point so the repeating phrases evolve.
- **New layout**: grows a zigzag chain of bars under each active emitter, each placed where a marble leaving the previous bar's low end will land. Chains are mirrored for symmetric emitters, the rest of the space is filled with bars leaning toward the middle, and bars keep clear of the toolbar. The default layout was hand-designed and then tuned with a headless simulation: every bar gets played on 375 px phones and desktops, at 7–10 notes per marble.
- **Persistence**: the layout is saved to `pg:marble-music:layout` on every committed edit and loaded in the canvas effect, then validated by `sanitizeLayout`. Controls are saved by `useControls`.
- **Theme**: canvas colors come from `--background` / `--foreground` at runtime. Pitch colors have dark and light tones. Glow uses a colored shadow bloom. Dark mode blends sparks additively, and light mode adds a soft marble shadow.
- **Responsive**: `ResizeObserver` rebuilds the bars and rescales marbles (position, size, speed) on resize or orientation change. DPR is capped at 2. The layout's height is bounded so the tall panel never pushes the canvas toolbar below the fold.
- **Reduced motion**: nothing drops before the first gesture. Trails, sparks, ripples, bar flex and emitter pulses are off. Glow and marble motion remain because they are the function.
- **Tab hidden**: the RAF loop stops (so the simulation pauses) and the AudioContext suspends. Both resume on return.

## AI Usage
None.

## Key Dependencies
- `matter-js` (2D rigid-body physics)
- Web Audio API (no audio library)
- `@/components/controls` (schema → panel, persistence, Randomize, Reset)
- `@/lib/storage` (layout persistence), `@/hooks/use-reduced-motion`, `next-themes`
- `lucide-react` icons, shadcn `Button`

## Component Tree
```
MarbleMusicPage (page.tsx, server)
└─ MarbleMusicApp (client)
   └─ ControlsLayout
      ├─ MarbleCanvas            canvas + MarbleMachine
      ├─ SoundPrompt             "Tap for sound" (before first gesture)
      ├─ MachineToolbar          Pause · Add bar · New layout · Sound
      └─ panel: ControlPanel + "Default layout" button
```

## Error Handling
- No 2D context: the canvas effect exits quietly.
- No Web Audio (or blocked): `MarbleAudio.start` is a no-op, and the machine still runs silently.
- Corrupt or outdated stored layout: `sanitizeLayout` drops bad bars, clamps values, regenerates duplicate ids and falls back to the default emitters (or to the whole default layout).
- Corrupt controls: `sanitizeValues` falls back to defaults per field.
- `localStorage` unavailable: nothing is persisted, and everything else works.
- `setPointerCapture` failing (pointer already gone) is caught.
- Voice overload: the oldest voices are faded out, and the compressor keeps the master from clipping.

## File Structure
```
marble-music/
├─ page.tsx               thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ marble-music-app.tsx   composes controls, canvas, toolbar, sound prompt, keyboard
├─ marble-canvas.tsx      canvas element, theme tokens, resize, pointer forwarding
├─ machine-toolbar.tsx    floating toolbar
├─ sound-prompt.tsx       start-sound pill (+ shared floating-bar style)
├─ use-marble-audio.ts    audio engine lifecycle, unlock, mute, tab visibility
├─ machine.ts             MarbleMachine: layout editing, gesture host, loop
├─ marble-world.ts        MarbleWorld: emitters, marbles, debounced strikes
├─ physics.ts             Matter.js wrapper (bars, walls, marbles, contacts)
├─ gestures.ts            multi-touch gesture state machine (pure)
├─ hit-test.ts            what's under a point (pure)
├─ arrangement.ts         sanitize / random layout / new-bar placement (pure)
├─ geometry.ts            stage mapping, bar geometry, distances, snapping (pure)
├─ music.ts               degree → MIDI → Hz, note names, velocity curve, colors (pure)
├─ effects.ts             ripples, sparks, bar glow/flex (pure)
├─ audio.ts               Web Audio engine
├─ render-frame.ts        draws a frame from a state view
├─ render-bars.ts         bars, knobs, note label
├─ render-scene.ts        backdrop, emitters, marbles + trails, effects
├─ data.ts                control schema, scales, instruments, palette, constants, default layout
└─ types.ts               shared types
```
