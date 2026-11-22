# Jack-o'-lantern

## What It Does
Carve a ribbed 3D-rendered pumpkin with your finger or mouse (knife, etch/scrape, stamps, mirror), light the candle and turn the lights off to watch the face glow and flicker. Carvings persist and can be saved as a PNG.

## Architecture
```
 useControls("pumpkin-carver")  ─► pg:pumpkin-carver:controls     (shape, variety, hue, ribs, glow…)
 carving-store (useSyncExternalStore) ─► pg:pumpkin-carver:carving (ops, not pixels)
                                     └► pg:pumpkin-carver:scene   (candle, lights, mirror)
          │ settings, ops, prefs
          ▼
 PumpkinCarverApp ──► ControlsLayout ─┬─► ControlPanel
                                      └─► PumpkinCanvas (pointer input) + CarveToolbar + SceneToggles
                                               │ setSettings / setOps / setLive / setTarget
                                               ▼
 engine.ts (plain object, owns canvases + RAF)
  ├─ pumpkin-render.ts  three.js, offscreen, ONLY on settings change
  │     geometry.ts (ribbed lathe body + twisted stem, pure arrays)
  │     └► "plates": body day/night + stem day/night (2D canvases, P×P device px)
  ├─ layers.ts  cached compositing layers (rebuilt on carve; only a dirty region mid-stroke)
  │     carving.ts replays ops → cut / etch masks (clipped to the body)
  │     inner opening = cut mask shifted inward+up (bevel), walls = cut at 7 depths, tinted
  │     skins = body plate + scraped flesh (lip, multiply shading, grain) − cuts
  │     etch glow (soft), glow source → near/far bloom (down-sampled, additive blur)
  ├─ cavity.ts  inside of the pumpkin (lit + dark back wall), candle + flame per frame
  ├─ flicker.ts layered 1D noise + gusts → intensity / sway / stretch   (pure)
  └─ frame.ts   per-frame composite: backdrop → floor glow → skins → etch glow → walls
                → interior ∩ inner opening → stem → bloom (lighter) → vignette
 export-png.ts  same pipeline at 1500px → PNG → save-image.ts (share sheet or download)
```

## Frontend
- **Rendering choice**: a hybrid "2.5D". three.js renders a physically lit pumpkin (MeshStandardMaterial, vertex-colored ribs, speckle/bump texture, small RoomEnvironment for reflections, ACES) once per settings change into 2D canvases, from a slightly elevated orthographic camera. All carving and lighting happens in 2D on top, so cuts are pixel-exact under the finger and nothing 3D runs per frame.
- **Coordinates** (`space.ts`): ops are stored in *face units* (round-pumpkin world units, y down). Tall/squat shapes stretch the face to fit; resizes don't affect the carving.
- **Holes and bevel**: the inner opening is the cut mask scaled toward the body center and lifted (we look slightly down into each hole), so the lower/outer wall shows as pale flesh. Walls are drawn at several depths: rind line → cream → shaded flesh by day, amber → bright yellow when candle-lit.
- **Glow**: candle-lit walls, the interior (with the actual candle visible through the mouth), soft etch glow, near/far bloom, a floor light pool and halo scaled by how much is carved (`layers.light`, measured from a tiny readback).
- **Flicker**: three octaves of 1D gradient noise plus a slow gust envelope that gates a fast stutter (`flicker.ts`). Drives brightness, flame lean and height. Never a sine.
- **Lights off / candle**: day and night plates cross-fade (`dark` eases over ~0.3s); the flame eases in/out. Night uses a cool moon rim and warm floor spill rig.
- **Tools**: Knife (freehand cut, width from the panel), Etch (2.4× wider scrape that thins the skin), Stamp (7 shapes; outline follows the mouse, or appears under the finger and commits on release; eyes flip automatically on the right side), Mirror (symmetric carving), Undo, Clear (undoable), Save.
- **Input**: pointer events with `touch-action: none`, coalesced events, min-step resampling, quadratic midpoint smoothing, RDP simplification on commit. One carving pointer at a time (palm-safe). Haptic tick on stamp (Android).
- **Performance**: during a stroke only the boxes around the newest points (+ bevel margin) are rebuilt via canvas clip regions (~10× cheaper than a full rebuild); full rebuild on commit. Device pixel ratio capped at 2, plate capped at 1400px.
- **Shortcuts**: K knife, E etch, S stamp, M mirror, C candle, L lights, ⌘/Ctrl+Z undo.
- **Responsive**: compact toolbar on top (icon-only under `sm`, labels from `sm`, 44px targets), candle/lights bottom-left on phones (controls button is bottom-right), bottom-center on desktop. When the mobile controls sheet opens, the pumpkin slides up and shrinks to stay visible (`use-sheet-inset.ts` watches the sheet). The layout is height-bounded so the desktop panel scrolls instead of pushing the canvas below the fold.
- **Theme**: backdrop reads `--background` / `--foreground` at runtime; the lights-off scene color is a per-theme content palette in `data.ts`. UI chrome uses tokens only.
- **Reduced motion**: steady flame, no flicker loop (renders on demand), instant transitions.
- **Default state**: a pre-carved classic face (triangle eyes, nose, toothy grin, etched brows), candle lit, lights off, so the first visit and the gallery thumbnail glow.

## AI Usage
None.

## Key Dependencies
- `three` (+ `three/examples/jsm/environments/RoomEnvironment`) for the offscreen pumpkin render; no React Three Fiber (nothing 3D is interactive).
- `@/components/controls` (panel, persistence, Randomize, Reset), `@/lib/storage`, `@/hooks/use-reduced-motion`, `next-themes`, shadcn `Button`, `Toggle`, `ToggleGroup`, `Separator`, `Collapse`, `sonner` toasts, `lucide-react` icons.

## Component Tree
```
PumpkinCarverPage (page.tsx, server)
└─ PumpkinCarverApp (client)
   └─ ControlsLayout
      ├─ div (relative, overflow-hidden)
      │  ├─ PumpkinCanvas      canvas + engine + pointer input
      │  ├─ CarveToolbar       tools, mirror, undo, clear, save
      │  │  └─ Collapse → StampPicker
      │  └─ SceneToggles       candle, lights off
      └─ ControlPanel
```

## Error Handling
- WebGL unavailable or context creation fails → `fallback-plates.ts` paints a simpler 2D pumpkin; carving and lighting still work.
- Persisted ops are validated op by op (`persist.ts`); bad entries are dropped, unknown versions ignored (falls back to the default face).
- Storage full: saves are verified by reading back; on failure we retry with only the visible carving and simplified strokes, then show one toast if it still doesn't fit.
- Share sheet cancelled → nothing; share refused (e.g. gesture expired while rendering) → falls back to a download. Export failure → toast.
- Corrupt control values → `sanitizeValues` per field.

## File Structure
```
pumpkin-carver/
├─ page.tsx               thin route entry + metadata
├─ metadata.json
├─ HOW_IT_WORKS.md
├─ pumpkin-carver-app.tsx composes controls, store, canvas, toolbars, shortcuts, save
├─ pumpkin-canvas.tsx     canvas element, engine lifecycle, pointer → ops
├─ carve-toolbar.tsx      top toolbar
├─ stamp-picker.tsx       stamp shapes (SVG previews of the same paths)
├─ scene-toggles.tsx      candle + lights
├─ use-sheet-inset.ts     how much of the canvas the mobile sheet covers
├─ carving-store.ts       ops/undo/clear/prefs external store + persistence
├─ persist.ts             validate / save ops with quota fallback
├─ engine.ts              scene object: dirty tracking, animation loop, export hook
├─ pumpkin-render.ts      three.js offscreen plates (day/night, body/stem)
├─ fallback-plates.ts     2D plates when WebGL is missing
├─ geometry.ts            body + stem meshes (pure)
├─ layers.ts              cached layers: masks, bevel walls, skins, glow, bloom
├─ layer-ops.ts           canvas helpers: buffers, tint, clip regions, blur, grain
├─ cavity.ts              interior, candle and flame
├─ frame.ts               per-frame composite
├─ export-png.ts          high-res still → PNG blob
├─ save-image.ts          share sheet / download
├─ carving.ts             op replay, smoothing, stamps, RDP (pure-ish)
├─ space.ts               face ↔ plate ↔ screen transforms, layout, stroke boxes (pure)
├─ flicker.ts             candle flicker model (pure)
├─ noise.ts               seeded PRNG, 1D gradient + 3D value noise (pure)
├─ color.ts               palettes from settings (pure)
├─ data.ts                control schema, stamps, default face, content palettes, constants
└─ types.ts
```
