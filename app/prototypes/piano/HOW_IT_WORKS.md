# Piano

## What It Does
A fullscreen, multi-touch piano for kids: big candy-colored keys (every note its own color, six color themes), soft synthesized sounds (piano, music box, marimba, bells, flute, warm pad, bubbles), glissando, and little notes, stars and hearts that float up from each key you press.

## Architecture
```
 useControls("piano", controls) ──► localStorage  pg:piano:controls
        │ values
        ▼
 PianoApp ──► ControlsLayout ──┬──► ControlPanel (side column on md+, bottom sheet on mobile)
   │ owns one PianoAudio       └──► PianoStage
   │ configure(sound, volume, echo)    │ useElementSize (stage + key surface)
   ▼                                   │ keyboard-layout.buildKeyboard(area, octaves…)  pure
 PianoAudio (audio-engine.ts)          │   └─ chooseRowCount: 1–3 do-to-do rows, best key shape
   AudioContext, created on the        ├──► StageTint (theme wash → last note's color)
   first gesture                       ├──► PianoRow × rows ──► PianoKey × keys (memo)
   ├─ synth.createVoice per press      │        colors.keyColor / keyVars        pure
   │   partials → amp env → [LPF] → pan├──► particle layer  (particles.spawnParticle, WAAPI)
   └─ master bus:                      └──◄ usePianoInput: pointer events per finger,
      HPF → shelf ─┬ dry ──────┐            elementFromPoint hit test, glissando,
                   └ reverb ─ wet ┴→ comp → volume → limiter → speakers
                     (reverb.ts: computed impulse)       computer keyboard (A–; / W–P)
```

## Frontend
- **State**: settings live in `useControls` (persisted, sanitized). Pressed notes are a `Set<midi>` derived from a press map (finger or computer key → note), so a note stays lit while any finger holds it and duplicate keys (the C that ends one row and starts the next) light together.
- **Input**: one `pointerdown` listener on the key surface plus `pointermove/up/cancel` on `window`. Each pointer is tracked separately (ten fingers work). On every move the hit test walks the segment in 10px steps, so a fast swipe still plays every key it crosses. `touch-action: none`, `user-select: none`, no callout, no context menu, no tap highlight.
- **Keyboard (desktop)**: physical key codes `A S D F G H J K L ;` = white keys from the lowest C, `W E T Y U O P` = black keys. Ignored while typing in a select/input or with modifier keys. No on-screen hints.
- **Audio unlock**: the `AudioContext` is created and resumed inside the first pointer/key handler and again on `pointerup` (touch only counts as a user activation on release in Chrome). The first note is scheduled immediately, so it plays as soon as the context runs; taps always last at least 120 ms. The stage exposes the context state as `data-audio` for checks.
- **Sound design**: additive synthesis (no samples). Higher partials decay faster than the fundamental (warmth), a band-passed noise "strike" gives the piano hammer and marimba mallet, a short pitch glide makes the bubble "bloop", looped breath noise makes the flute. Notes above 900 Hz are turned down a little, a high shelf (−5 dB at 5 kHz) softens everything, a compressor and a limiter keep ten-finger mashing from clipping, voices beyond 22 steal the oldest with a 40 ms fade. Pan follows the key position (±0.25).
- **Layout**: the app is exactly `100dvh − 56px`. Rows split the range at octave boundaries; each row is a full do-to-do scale, higher octaves on top. The row count is the one whose white keys come closest to a chunky 4:1 shape without going under 40px wide (portrait phones get 2 rows of 8, landscape phones 1 row of 15, desktop 2 rows). Black keys get slimmer on narrow keys and never taller than 5× their white key's width.
- **Floating controls button (phones)**: the stage keeps it off the keys, with a strip below them in portrait and beside them in landscape (safe-area aware).
- **Theme**: key colors are content colors (OKLCH, per theme in `color-themes.ts`), slightly deeper in dark mode. `useIsDark` reports dark during hydration so server and client markup match.
- **Motion**: keys enter in a left-to-right wave; a pressed face slides down over its darker lip, brightens and glows (60 ms in, 420 ms ease-out-quint back). Shapes float up with ease-out-quint motion and a separate linear fade. The stage wash fades to the last note's color. **Reduced motion**: no particles; press feedback stays.
- **API**: none.

## AI Usage
None.

## Key Dependencies
- Web Audio API (no Tone.js: the engine is ~400 lines and fully controllable; the same code renders offline)
- `@/components/controls` (panel, persistence, Randomize, Reset)
- `@/hooks/use-mobile`, `@/hooks/use-reduced-motion`, `next-themes`

## Component Tree
```
PianoPage (page.tsx, server)
└─ PianoApp (client)
   └─ ControlsLayout
      ├─ PianoStage
      │  ├─ StageTint
      │  ├─ PianoRow × 1–3
      │  │  └─ PianoKey × keys
      │  └─ particle layer (imperative SVGs)
      └─ ControlPanel
```

## Error Handling
- No Web Audio (or the constructor throws) → keys still light up and animate, silently.
- `resume()` rejections are swallowed; the next gesture tries again.
- Window blur / tab hidden → every held note is released (no stuck notes).
- Corrupt persisted settings → `sanitizeValues` falls back to defaults per field.
- Old browsers without `StereoPannerNode` → no pan, everything else works.

## File Structure
```
piano/
├─ page.tsx             thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ piano-app.tsx        controls + layout + one PianoAudio
├─ piano-stage.tsx      measuring, layout, press bookkeeping, particles, FAB clearance
├─ piano-row.tsx        one do-to-do row
├─ piano-key.tsx        one key (lip + face + name chip), memoized
├─ stage-tint.tsx       background wash
├─ use-piano-input.ts   multi-touch, glissando, computer keyboard
├─ use-element-size.ts  ResizeObserver size
├─ use-is-dark.ts       hydration-safe theme flag
├─ audio-engine.ts      AudioContext, master bus, voice pool (no React)
├─ synth.ts             one voice: partials, envelopes, strike, breath, glide (pure Web Audio)
├─ reverb.ts            computed stereo impulse response
├─ particles.ts         floating shapes (DOM + Web Animations)
├─ keyboard-layout.ts   rows and key positions (pure)
├─ music.ts             note math, labels, key mapping, loudness trim (pure)
├─ colors.ts            theme → key colors and CSS vars (pure)
├─ random.ts            seeded PRNG
├─ data.ts              control schema, constants, key map, particle shapes
├─ sound-presets.ts     the seven sound presets (data)
├─ color-themes.ts      the six color themes (data)
└─ types.ts
```
