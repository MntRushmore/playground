# Doodle Armies

## What It Does
Draw armies of hand-inked units on a paper battlefield, press Battle, and watch them
come alive and fight to a winner. Play in Sandbox (draw both sides) or vs CPU (spend a
point budget against a generated enemy). An auto-running demo battle plays on first load.

## Architecture
```
 useControls("doodle-armies", controls) ──► localStorage pg:doodle-armies:controls
          │ values (mode, brush size, speed, budget, difficulty, seed)
          ▼
 DoodleArmiesApp (client, owns the BattleEngine in state)
   │  applySettings(values) on change ─────────────► BattleEngine ◄── useSyncExternalStore
   │  roster persisted (debounced) ──► pg:doodle-armies:roster        (snapshot → HUD/palette/banner)
   │
   ├─ ControlsLayout ──┬─ ControlPanel (side on md+, bottom sheet on mobile)
   │                   └─ battlefield stage
   │                        ├─ BattlefieldCanvas  (RAF + pointer + resize + theme)
   │                        │     every frame:  engine.advance(dt)  then  renderScene(...)
   │                        ├─ Hud          (mode, live counts, Battle/Pause/Reset)
   │                        ├─ UnitPalette  (brush + team, draw phase only)
   │                        └─ ResultBanner (victory/defeat, ended phase only)
   ▼
 BattleEngine
   ├─ roster: PlacedUnit[]            (what you draw; the persisted source of truth)
   ├─ world: units/projectiles/effects + bounds + time + shake
   ├─ advance(realDt): fixed-timestep accumulator → stepWorld(...) ×N, then battleResult()
   └─ presets: demo / random / cpu army generation (seeded, deterministic)

 stepWorld (pure)                       renderScene (pure)
   ├─ Grid.build (spatial hash)           ├─ paper + grid + team home washes
   ├─ targeting (expanding-ring)          ├─ ground effects (ink splats, AoE rings)
   ├─ steering + separation               ├─ unit doodles (rough blobs + per-kind glyph)
   ├─ attack: melee/cleave, projectiles   ├─ projectiles (inked arrows / orbs)
   ├─ damage / heal / deaths (ink splat)  └─ air effects (poofs, floating numbers)
   └─ battleResult: last team / timeout
```

## Frontend
- **State**: the `BattleEngine` (plain class, held in `useState`) owns all mutable game
  state. React reads a small cached `Snapshot` via `useSyncExternalStore`; control values
  live in `useControls` and are pushed into the engine with `applySettings` on change. The
  canvas reads the engine directly inside its RAF loop, so battles never trigger re-renders.
- **Phases**: `draw` → place units; `battle` → simulation runs; `ended` → winner banner.
  Reset returns to `draw` with the roster preserved (so you can edit and re-fight).
- **Simulation**: a fixed timestep (1/60s) fed by an accumulator scaled by Battle speed, so
  the outcome is consistent regardless of frame rate and **deterministic given a seed**
  (seeded RNG for jitter and tie-breaks). Neighbour queries use a uniform spatial-hash grid;
  targets are found by expanding-ring search and re-acquired on a staggered interval. Units
  cap at 440 for steady 60fps (verified ~60fps at 185 vs 180).
- **No stalemates**: a battle ends when a team is wiped, or at a 50s timeout resolved by
  total remaining HP (equal → draw).
- **Drawing**: pointer drag paints squads of `Brush size` units spread perpendicular to the
  stroke (tap = one squad); `touch-action: none` + pointer capture for multi-touch-safe
  dragging. vs CPU enforces your point budget; Sandbox only caps total units.
- **Responsive**: positions are stored in field units with a fixed width (1000) and a
  height that follows the canvas aspect, so a battle looks right on phone and desktop; Y is
  rescaled proportionally on resize. HUD is a top overlay; the brush palette is a
  bottom overlay that clears the controls button on mobile.
- **Theme**: the paper background and ink come from the `--background` / `--foreground`
  tokens read at runtime (light = paper, dark = chalkboard); team colors are content.
- **Reduced motion**: no auto-demo, and wobble / floating numbers / ink splats / screen
  shake are all suppressed; units still move, fight, and show HP so the battle stays readable.
- **Persistence**: control settings and the drawn roster are saved (debounced) to
  localStorage, namespaced and validated on load. The sim pauses when the tab is hidden.

## API
None. Fully client-side and offline; no network calls, no API routes.

## AI Usage
None.

## Key Dependencies
- `@/components/controls` (schema → panel, persistence, Randomize, Reset)
- `@/components/motion`, `@/hooks/use-reduced-motion`, `@/lib/storage`
- `next-themes` (`resolvedTheme` for ink/paper), `lucide-react` (toolbar icons)
- No physics/3D/animation library: the agent simulation, steering, spatial grid, seeded RNG,
  and hand-drawn canvas rendering are all custom and self-contained.

## Component Tree
```
DoodleArmiesPage (page.tsx, server)
└─ DoodleArmiesApp (client)
   └─ ControlsLayout
      ├─ battlefield stage (relative)
      │  ├─ BattlefieldCanvas
      │  ├─ Hud
      │  ├─ UnitPalette      (draw phase)
      │  └─ ResultBanner     (ended phase)
      └─ ControlPanel
```

## Error Handling
- Missing 2D context → the canvas effect exits quietly (blank area, no crash).
- Corrupt/outdated persisted controls → `sanitizeValues` falls back to defaults per field;
  a corrupt saved roster → `loadRoster` validates every entry and drops bad ones.
- `localStorage` unavailable (private mode / quota) → reads/writes are wrapped and ignored.
- Resize to a zero-size container is skipped; unit positions are clamped into new bounds.
- Empty field → Battle is disabled; a battle that can't deal damage ends at the timeout.

## File Structure
```
doodle-armies/
├─ page.tsx                thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ doodle-armies-app.tsx   composition, state wiring, demo, persistence
├─ battlefield-canvas.tsx  canvas, RAF loop, pointer drawing, resize, theme
├─ hud.tsx                 top bar: mode, live counts, Battle/Pause/Reset
├─ unit-palette.tsx        bottom toolbar: unit brush + team selection
├─ result-banner.tsx       victory / defeat / draw overlay
├─ data.ts                 control schema + simulation constants
├─ types.ts                shared types (Unit, Projectile, Effect, World, …)
├─ units.ts                unit roster + stats (the game's balance content)
├─ palette.ts              team / ink colors + runtime theme-token reader
├─ presets.ts              seeded army generation (demo / random / cpu)
├─ rng.ts                  seeded PRNG (mulberry32) + helpers
├─ spatial-grid.ts         uniform spatial hash for neighbour queries
├─ combat.ts               the simulation step (pure): target / steer / attack / deaths
├─ engine.ts               world + roster + phase/winner + fixed-timestep driver
├─ rough.ts                hand-drawn blob / line canvas primitives (pure)
├─ unit-art.ts             per-kind unit doodle + HP bar (pure)
└─ render.ts               scene renderer: paper, effects, units, projectiles (pure)
```
