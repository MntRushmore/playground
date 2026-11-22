# Flow Field

## What It Does
Thousands of particles drift through a slowly evolving 3D simplex-noise field and leave fading trails on a canvas. Every parameter is tunable from a control panel with Randomize.

## Architecture
```
 useControls("flow-field", controls)  ──► localStorage  pg:flow-field:controls
          │ values
          ▼
 FlowFieldApp ──► ControlsLayout ──┬──► ControlPanel (side on md+, bottom sheet on mobile)
                                   └──► FlowCanvas
                                          │ settingsRef (no effect restart on tweak)
                                          ▼
              requestAnimationFrame loop
              ├─ simulation.stepParticles(pool, noise, time)   pure
              │     └─ noise.createNoise3D(seed)                pure
              ├─ palette.fadeAlpha / spectrumColors            pure
              └─ canvas 2D: translucent bg fill + batched Path2D strokes
```

## Frontend
- **State**: control values live in `useControls` (persisted, validated against the schema on load). The canvas reads them through a ref, so slider drags never restart the loop.
- **Rendering**: one `Path2D` per hue bucket (24) in spectrum mode, one path otherwise, which keeps 4,000 particles at 60fps on phones.
- **Theme**: canvas colors come from the `--background` / `--foreground` CSS tokens at runtime; `resolvedTheme` only decides lightness of spectrum hues and restarts the loop on theme change.
- **Responsive**: `ResizeObserver` resizes the canvas (DPR capped at 2) and respawns particles; speed scales with canvas size.
- **Reduced motion**: draws a single still image of streamlines instead of animating, and redraws it when settings change.
- **Progressive disclosure**: the Tint control only appears (animated) when Palette is Tint.

## AI Usage
None.

## Key Dependencies
- `@/components/controls` (schema → panel, persistence, Randomize, Reset)
- `next-themes` (`resolvedTheme`)
- No third-party noise library: `noise.ts` is a seeded simplex implementation.

## Component Tree
```
FlowFieldPage (page.tsx, server)
└─ FlowFieldApp (client)
   └─ ControlsLayout
      ├─ FlowCanvas
      └─ ControlPanel
```

## Error Handling
- Missing 2D context → effect exits quietly (blank area, no crash).
- Corrupt or outdated persisted settings → `sanitizeValues` falls back to defaults per field.
- `localStorage` unavailable → settings just aren't persisted.

## File Structure
```
flow-field/
├─ page.tsx            thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ flow-field-app.tsx  composes controls + layout + canvas
├─ flow-canvas.tsx     canvas, RAF loop, resize, theme colors
├─ data.ts             control schema + constants
├─ types.ts            FlowSettings, Particle, Bounds, ThemeColors
├─ noise.ts            seeded 3D simplex noise (pure)
├─ simulation.ts       particle spawn/step (pure)
└─ palette.ts          stroke colors + fade (pure)
```
