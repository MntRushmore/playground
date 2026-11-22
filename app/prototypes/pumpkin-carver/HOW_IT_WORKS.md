# Jack-o'-lantern

## What It Does
A cinematic pumpkin-carving scene: a photoreal ribbed pumpkin on a plank table among out-of-focus pumpkins. You carve, etch and patch with your finger or mouse (or tap a face preset), light the candle and turn the lights off to watch the face blaze, bleed light onto the table and flicker. Carvings persist and export as PNG.

## Architecture
```
 useControls("pumpkin-carver")  ─► pg:pumpkin-carver:controls     (shape, variety, hue, ribs, glow…)
 carving-store (useSyncExternalStore) ─► pg:pumpkin-carver:carving (ops v2, not pixels)
                                     └► pg:pumpkin-carver:scene   (candle, lights, sound)
          │ settings, ops, prefs
          ▼
 PumpkinCarverApp ──► ControlsLayout ─┬─► ControlPanel
                                      └─► PumpkinCanvas (pointer → strokes, sound cues)
                                          TopBar (candle · Carve/Etch/Patch · lights)
                                          BottomDock (face presets · undo/new/save · color/share/sound)
                                               │ setSettings / setOps / setLive / setTarget
                                               ▼
 engine.ts (plain object, owns canvases + RAF)
  ├─ studio.ts           one offscreen three.js renderer + small RoomEnvironment
  ├─ pumpkin-render.ts   hero plates, ONLY on settings change: body day / night / glow, stem day / night
  │     geometry.ts (ribbed lathe body + twisted stem), textures.ts (skin color/normal/roughness)
  ├─ set-render.ts       plank table, board wall, 5 small pumpkins, shadow decals; perspective camera
  │     aimed so the hero plate sits on the table → set-compose.ts (DOF, haze, bokeh, warm-lit copy)
  ├─ layers.ts           cached layers (rebuilt on carve; only a dirty region mid-stroke):
  │     carving.ts + shapes.ts replay ops → cut / etch masks (patch erases), chiseled edges
  │     inner opening, thick bevelled walls, lip shadow, skins (day/night/glow), etch glow,
  │     glow source → near/far bloom + zoom-blurred light shafts
  ├─ cavity.ts           interior back wall + candle and flame
  ├─ flicker.ts          layered 1D noise + gusts → intensity / sway / stretch   (pure)
  ├─ atmosphere.ts       drifting dust/ember motes, film grain                    (time-driven)
  └─ frame.ts            per-frame composite (see below)
 export-png.ts  same pipeline at 1500 px with its own set render → PNG → save-image.ts
 sound.ts       Web Audio: knife scrape, preset thunk, match strike, snuff, crackle
```

Per frame (`frame.ts`): set (day ↔ night) → warm-lit set + table pool ∝ candle light → contact shadow → skins (day, night, candle glow) → etch glow → walls (day, candle-lit) → interior ∩ openings (clipped to their bounding box) → stem → bloom + shafts (additive) → motes → vignette → grain → fade-in.

## Frontend
- **Rendering**: a pre-baked 3D scene plus a 2D carving/glow composite. three.js renders the hero pumpkin (MeshPhysicalMaterial: vertex-colored ribs, procedural normal map for fine bumps and pores, roughness map, clearcoat for the waxy highlight, sheen for the soft falloff) and the set once; nothing 3D runs per frame. The candle-glow plate is rendered matte with a warm frontal light and masked around the openings, which gives the "light scattering through the flesh" warmth.
- **Set**: the perspective camera's principal point is placed on the hero plate's origin (`setViewOffset`), with matching elevation and scale, so the orthographic hero sits on the table. Depth of field: far layer blurred heavily, mid lightly, the table under the pumpkin sharp; plus haze and a few soft bokeh discs. A pre-tinted, radially masked copy of the set is added at night, scaled by candle light × flicker, so the boards and wall visibly catch the glow.
- **Coordinates** (`space.ts`): ops are stored in face units (round-pumpkin world units, y down); tall/squat shapes stretch the face.
- **Carved walls**: the inner opening is the cut shifted toward the body center and up (we look slightly down into each hole); the wall band is drawn at nine depths: dark rind line → bright cut edge → flesh → shaded (day) or amber → hot yellow (candle). A lip shadow darkens the interior under the top edge of every opening. Shapes are polygons "chiseled" with seeded jitter; knife strokes waver in width per segment so edges read hand-cut.
- **Tools**: Carve (knife), Etch (scrape the skin thin; glows softly), Patch (fills carved/etched areas back in, distinct from Undo). Face presets (Jack, Grin, Fiend, Cat, Ghost, Stars, Lantern) replace the carving as one undoable op and can then be tweaked. New = clear (undoable) + a fresh pumpkin variation. Save downloads a PNG; Share opens the share sheet (falls back to download). The color swatch sets variety/hue in the control panel.
- **Input**: pointer events, `touch-action: none`, coalesced events, min-step resampling, RDP on commit, single carving pointer (palm-safe). Knife scrape volume/brightness follows stroke speed.
- **Glow & flicker**: bloom (near + oversized far), light shafts, warm set and table pool, candle-lit skin, ember motes near the face; all modulated by a noise flicker (breathing, shiver, gusts), never a sine.
- **Lights**: Lights on = warm dusk interior; Lights off = cool moonlight with the candle as the key light. Both are rendered plates cross-faded (`dark` eases ~0.3 s); the flame eases in/out.
- **Performance**: per frame only drawImage blits, a few gradients, ~46 mote sprites and one grain pattern fill; fully covered layers are skipped; the interior pass is clipped to the openings' box; during a stroke only dirty regions are rebuilt. DPR capped at 2, hero plate ≤ 1400 px, set rendered at ≤ CSS-pixel resolution (it's mostly out of focus). RAF pauses when the tab is hidden; crackle stops too.
- **Responsive**: top bar (candle · segmented tools with labels · lights) fits 375 px; the dock is a 7-column preset grid with 44 px targets and an icon-only action row on phones (labels from `sm`), leaving room for the shared controls button. When the mobile controls sheet opens, the pumpkin shrinks above it and the set slides with it (`use-sheet-inset.ts`).
- **Theme**: the scene is a photographic set and stays dark in both themes; all chrome (bars, dock, popover) uses tokens and follows the theme. Pumpkin/flesh/candle/wood colors are content palettes in `data.ts`.
- **Reduced motion**: steady flame, motes and grain frozen, no animation loop (renders on demand), instant transitions.
- **Sound**: off by default; the AudioContext is only created from a gesture. Shortcuts: K/E/P tools, C candle, L lights, ⌘/Ctrl+Z undo.
- **Default state**: the Jack preset, candle lit, lights off, so the first visit and the thumbnail glow.

## AI Usage
None.

## Key Dependencies
- `three` (+ `RoomEnvironment`) for the offscreen hero and set renders; no React Three Fiber (nothing 3D is interactive).
- Web Audio API (no Tone.js needed for a handful of noise-based cues).
- `@/components/controls`, `@/lib/storage`, `@/hooks/use-reduced-motion`, `next-themes`, shadcn `Button`, `Toggle`, `ToggleGroup`, `Popover`, `Separator`, `sonner`, `lucide-react`.

## Component Tree
```
PumpkinCarverPage (page.tsx, server)
└─ PumpkinCarverApp (client)
   └─ ControlsLayout
      ├─ div (relative, overflow-hidden)
      │  ├─ PumpkinCanvas     canvas + engine + pointer input
      │  ├─ TopBar            candle, Carve/Etch/Patch, lights off
      │  └─ BottomDock        hint, face presets, undo/new/save, HueSwatch, share, sound
      └─ ControlPanel
```

## Error Handling
- WebGL unavailable → `fallback-plates.ts` paints a simpler 2D pumpkin and the set falls back to a plain dark backdrop; carving and lighting still work.
- Persisted ops validated op by op (`persist.ts`, version 2); bad entries dropped; older versions ignored (falls back to the default face).
- Storage full → retries with only the visible carving and simplified strokes, then one toast.
- Share cancelled → nothing; share refused → download. Export failure → toast.
- No AudioContext → sounds are silently skipped.

## File Structure
```
pumpkin-carver/
├─ page.tsx               thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ pumpkin-carver-app.tsx composes controls, store, canvas, bars, shortcuts, save/share, sound
├─ pumpkin-canvas.tsx     canvas element, engine lifecycle, pointer → stroke ops
├─ top-bar.tsx            candle · segmented tools · lights
├─ bottom-dock.tsx        hint, face presets (icons drawn from the shapes), action row
├─ hue-swatch.tsx         pumpkin color popover
├─ use-sheet-inset.ts     how much of the canvas the mobile sheet covers
├─ carving-store.ts       ops/undo/clear/faces/prefs external store + persistence
├─ persist.ts             validate / save ops with quota fallback
├─ engine.ts              dirty tracking, animation loop, set/hero orchestration, export hook
├─ studio.ts              shared offscreen three.js renderer
├─ pumpkin-render.ts      hero plates (day / night / glow, stem)
├─ set-render.ts          table, wall, background pumpkins, aligned perspective camera
├─ set-compose.ts         depth of field, haze, bokeh, warm-lit copy (2D)
├─ textures.ts            procedural skin, plank and shadow textures
├─ fallback-plates.ts     2D plates when WebGL is missing
├─ geometry.ts            body + stem meshes (pure)
├─ layers.ts              cached layers: masks, walls, lip shadow, skins, glow, bloom, shafts
├─ layer-ops.ts           canvas helpers: buffers, tint, clip regions, blur, grain
├─ cavity.ts              interior, candle and flame
├─ frame.ts               per-frame composite
├─ atmosphere.ts          motes and film grain
├─ export-png.ts          high-res still → PNG blob
├─ save-image.ts          download / share sheet
├─ sound.ts               Web Audio cues
├─ carving.ts             op replay, faces expansion, hand-cut strokes, RDP
├─ shapes.ts              carvable polygons + chisel jitter
├─ faces.ts               face presets as ops
├─ space.ts               face ↔ plate ↔ screen transforms, layout, stroke boxes (pure)
├─ flicker.ts             candle flicker model (pure)
├─ noise.ts               seeded PRNG, 1D gradient + 3D value noise (pure)
├─ color.ts               palettes from settings (pure)
├─ data.ts                control schema, swatches, set props, content palettes, constants
└─ types.ts
```
