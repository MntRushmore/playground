# Prototype Playground: Rules for Agents

This repo is a personal prototype playground: one Next.js app holding many small, self-contained prototypes (apps, games, simulations, tools). The owner asks you for new prototypes, often from a phone. Read this whole file before every task. These rules are non-negotiable unless the owner explicitly overrides one for a specific task.

> **Next.js 16**: APIs differ from older versions (`middleware` is now `proxy.ts`, `params` are async, etc.). Read the relevant guide in `node_modules/next/dist/docs/` before using an API you're unsure about.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (no password gate in dev) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Regenerates registry + route types, then `tsc --noEmit` |
| `pnpm build` | Production build |
| `pnpm check` | lint + typecheck + build. **Run before finishing any task.** |
| `pnpm thumbnails <slug> [slug…]` | Build, then capture light/dark thumbnails (+ OG media if public) |
| `pnpm thumbnails --missing` | Only prototypes missing thumbnails / OG media |
| `pnpm thumbnails --skip-build` | Reuse the existing `.next` build |
| `pnpm thumbnails --delay 4000` | Wait longer before capturing (slow-starting prototypes) |
| `pnpm registry` | Regenerate `lib/registry.generated.ts` manually |

Package manager is **pnpm**. Install new dependencies at the repo root (`pnpm add <pkg>`).

---

## Repo map

```
app/
├── page.tsx                 homepage gallery (search, tags, hidden toggle, static thumbnails)
├── layout.tsx               root layout + ThemeProvider (dark default, system respected)
├── prototypes/
│   ├── layout.tsx           header (back, title, theme) around every private prototype
│   ├── [slug]/page.tsx      404 fallback for unknown slugs
│   └── <slug>/              ONE FOLDER PER PROTOTYPE (see below)
├── p/[slug]/page.tsx        public route: renders the same component, only for "public": true
├── login/                   password page
└── api/
    ├── auth/route.ts        login (POST) / logout (DELETE)
    └── <slug>/…             API routes for a prototype, always namespaced by its slug
components/
├── ui/                      shadcn/ui (all components installed, Radix-based "nova" style)
├── controls/                schema-driven control panel library (see below)
├── motion/collapse.tsx      height open/close animation
└── playground/              gallery, header, theme toggle (app chrome, not for prototypes)
hooks/                       use-local-storage, use-reduced-motion, use-mobile
lib/
├── prototypes.ts            reads the registry (server-only)
├── registry.generated.ts    AUTO-GENERATED, git-ignored. Never edit.
├── public-slugs.generated.ts AUTO-GENERATED, git-ignored. Never edit.
├── controls/schema.ts       control schema types + defaults/randomize/sanitize
├── storage.ts               safe namespaced localStorage
└── auth.ts                  password gate helpers
proxy.ts                     password gate (Next 16 "proxy", formerly middleware)
public/thumbnails/           <slug>-light.jpg, <slug>-dark.jpg (640×400)
public/og/                   <slug>.png, <slug>.mp4. Public prototypes ONLY (served without auth)
scripts/                     generate-registry.mjs, capture-thumbnails.ts
```

**How discovery works:** `scripts/generate-registry.mjs` scans `app/prototypes/*/` for folders with `page.tsx` + `metadata.json` and writes `lib/registry.generated.ts` (metadata, a lazy import of the page, and which thumbnail/OG files exist). It runs automatically on `pnpm dev` (and watches for new folders), `pnpm build`, `pnpm lint`, and `pnpm typecheck`. Folder names must be kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`).

---

## Creating a new prototype (start → pull request)

New prototypes are only ever created by you, the agent. Never build a "new prototype" button or create API in the app.

1. **Branch**: `git checkout -b proto/<slug>` from an up-to-date `main`.
2. **Folder**: `app/prototypes/<slug>/` (kebab-case, short, descriptive).
3. **`metadata.json`**:
   ```json
   {
     "title": "My Prototype",
     "description": "What it does, in one sentence.",
     "tags": ["tag1"],
     "createdAt": "YYYY-MM-DD",
     "updatedAt": "2026-01-01T12:00:00Z",
     "hidden": false,
     "public": false
   }
   ```
   Use the real current date/time (`date -u +%Y-%m-%dT%H:%M:%SZ`).
4. **`page.tsx`**: thin (~60 lines max). Default-export a component with **no required props** (the public route renders it as `<Prototype />`). Export `metadata` from `metadata.json`:
   ```tsx
   import type { Metadata } from "next";
   import { MyApp } from "./my-app";
   import meta from "./metadata.json";

   export const metadata: Metadata = { title: meta.title, description: meta.description };

   export default function MyPrototypePage() {
     return <MyApp />;
   }
   ```
   The page renders inside `<main className="flex min-h-0 flex-1 flex-col">` under a 56px header. Fill it with `flex-1`; don't add your own back button or theme toggle (the header has both).
5. **Split the code** (see *Self-contained and decomposed*): `types.ts`, `data.ts`, pure logic files, one file per meaningful component.
6. **`HOW_IT_WORKS.md`**: all required sections (see *Documentation*). `app/prototypes/flow-field/HOW_IT_WORKS.md` is the reference.
7. **Verify in a browser**: run `pnpm dev`, open `/prototypes/<slug>` at **375px** and desktop width, in **dark and light**. Use Playwright to screenshot and actually look. Check there are no console errors.
8. **Thumbnails**: `pnpm thumbnails <slug>`, then **open both images and check them**.
9. **`pnpm check`** must pass.
10. **Commit** (code + thumbnails together), push, open a PR (`gh pr create`).
11. **Finish by posting the preview link** (Vercel comments it on the PR; or `gh pr view --json url` plus the deployment URL from `gh pr checks`), so the owner can open it on their phone.

`app/prototypes/flow-field/` is the canonical example. Copy its structure.

---

## Rules for every prototype

### Metadata
- Every prototype has a `metadata.json` with the exact shape above.
- **Bump `updatedAt` on every edit** (ISO timestamp, real current time) so the gallery stays sorted.
- `hidden: true` hides it from the gallery unless "Show hidden" is on.

### Documentation
Every prototype has a `HOW_IT_WORKS.md`, **updated in the same commit as every change**, with these sections:
- **What It Does**: 1–2 sentences
- **Architecture**: ASCII data-flow diagram
- **Frontend / API**: bullets on state, shortcuts, responsive behavior, request/response shapes
- **AI Usage** (if any model is called): model ID, why that model, how it's called, key parameters, system prompt summary, user prompt shape. Otherwise write "None."
- **Key Dependencies**, **Component Tree**, **Error Handling**, **File Structure**

### Self-contained and decomposed
- Each prototype lives entirely in its own folder (plus optional `app/api/<slug>/`). **Never import from another prototype.** Shared code goes in `components/`, `hooks/`, or `lib/` only if it's genuinely generic.
- **Never write one giant file.** Keep `page.tsx` thin and split out:
  - `types.ts`: shared types
  - `data.ts`: mock data, constants, config, control schema
  - pure logic files (`physics.ts`, `music.ts`, `search.ts`, `utils.ts`…): no React, testable alone
  - one file per meaningful UI component, named descriptively (`piano-keyboard.tsx`, not `components.tsx`)
- Rough guide: if a file passes ~200 lines, split it.

### Design system
- Always use `components/ui/*` and the design tokens: `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `bg-muted`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-accent`, `border-border`, `ring-ring`, `text-destructive`, `chart-1…5`.
- **Never hardcode colors** in UI: no `bg-black`, `text-white`, `bg-zinc-900`, hex values, or inline `style={{ color }}`.
  - Exception: *content* the user creates or tunes (a particle tint, a piano key color the user picks, a pumpkin's orange) can be data. Keep such palettes in `data.ts`, and make sure they read well on both themes.
  - Canvas/WebGL: read tokens at runtime with `getComputedStyle(el).getPropertyValue("--background")` (see `flow-canvas.tsx`).
- **Check the actual component source in `components/ui/` before assuming a prop exists.** These are shadcn "radix-nova" components; they differ from docs and from other shadcn styles (e.g. the Slider takes `value: number[]`, Drawer is vaul, `cn` comes from the `cn` package).
- Icons: `lucide-react`.

### Clean and minimal by default
- Start with a single centered column (`mx-auto w-full max-w-2xl px-4`). No sidebars, split panels, or tab-heavy layouts unless asked. (Full-bleed canvases/games are fine: the subject *is* the layout.)
- Build only what was asked for. No extra dashboards, charts, stats, or views.
- Fewer elements is better; every element must justify its existence. Plain badges (`variant="outline"` / `secondary`) over colorful ones. No decorative icons, no sparkle icons, no emoji in UI chrome.
- Minimal interface copy. No captions that restate labels, no hints nobody needed, no editorial labels, no extraneous counts.
- Complexity is earned and progressively disclosed (e.g. `when:` on a control).

### Control panels
- Anything with tunable parameters (speed, color, size, count) gets a control panel, not scattered inputs.
- Use the shared library. You get the panel, persistence, Reset and **Randomize** for free:
  ```tsx
  // data.ts
  import { defineControls } from "@/lib/controls/schema";
  export const controls = defineControls({
    speed: { type: "number", label: "Speed", min: 0, max: 5, step: 0.1, default: 1 },
    trails: { type: "boolean", label: "Trails", default: true },
    shape: { type: "select", label: "Shape", options: ["circle", "square"], default: "circle" },
    tint: { type: "color", label: "Tint", default: "#8b5cf6", when: (v) => v.shape === "circle" },
  });
  // types.ts
  export type Settings = ControlValues<typeof controls>;
  // my-app.tsx
  const c = useControls(SLUG, controls);           // persisted to pg:<slug>:controls
  <ControlsLayout panel={<ControlPanel controls={c} />}>
    <Subject settings={c.values} />
  </ControlsLayout>
  ```
  Options: `randomize: false` (exclude from Randomize), `randomRange: [lo, hi]` (keep random results tasteful), `format: (v) => string`, `optionLabels`, `when: (values) => boolean`.
- Every control panel has Randomize ("surprise me") next to Reset. The library does this; don't remove it.
- `ControlsLayout` puts the panel in a side column on desktop (never covering the subject) and a non-modal bottom sheet on mobile. If you need a new control type, add it to the library, not the prototype.

### Mobile first
- Everything must work at **375px wide**. Test it.
- Tap targets ≥ **44×44px** (`size-11`, `h-11`, `min-h-11`).
- Icon-only buttons on mobile, labels from `sm:` up: `<Icon /><span className="hidden sm:inline">Label</span>` with an `aria-label`.
- No hover-only interactions. Every `hover:` state needs a visible touch equivalent (`active:`, a toggle, or always-visible).
- Code blocks wrap (`whitespace-pre-wrap break-words`); no horizontal page scrolling, ever.
- Modals/lightboxes need visible prev/next buttons or swipe on mobile, not just keyboard shortcuts.
- Respect safe areas for full-screen UIs (`env(safe-area-inset-*)`). Use `dvh`, not `vh`.
- Games/instruments: use pointer events (`onPointerDown`), support multi-touch where it makes sense, and set `touch-action: none` on the play surface.

### Light and dark mode
- Design dark-first; light mode must also work, via tokens.
- **Never hardcode a `dark` class** on a page or element. The theme is global (next-themes, class on `<html>`).
- Use `useTheme()` / `resolvedTheme` only when *behavior* must change by theme (canvas/WebGL colors, scene lighting). It's `undefined` on the server/first render; handle that.

### Motion
- Rows or sections the user adds or removes **animate their height** open/closed. Use `<Collapse open={…}>` / `<Collapse appear>` from `@/components/motion/collapse`. Nothing pops in and makes the page jump.
- Smooth deceleration curves, no bouncy overshoot: `ease-(--ease-out-quint)` or `ease-(--ease-out-expo)`, 200–400ms.
- Respect `prefers-reduced-motion`: CSS transitions are shortened globally; for JS/canvas animation use `useReducedMotion()` and render a still or calmer version.
- **Verify animations actually run**: check computed `transition`/`animation` styles in the browser. Utility classes (e.g. `animate-in`) silently do nothing if their CSS isn't imported (`tw-animate-css` is imported in `globals.css`).

### Audio
- Browsers block audio until a user gesture: create/resume the `AudioContext` (or `Tone.start()`) inside a pointer/key handler.
- iOS silent switch mutes Web Audio by default; that's expected, not a bug.
- Schedule notes on the audio clock, not `setTimeout`, when timing matters. Release voices so they don't pile up.

### AI-backed prototypes
- Call models **server-side** through `app/api/<slug>/…/route.ts`; never expose keys to the client. Keys live in Vercel env vars (`vercel env add`), never in code.
- If a model generates UI or layout, put explicit layout constraints in the system prompt (max columns, no wide tables, mobile width). Defensive CSS is a backup, not the fix.
- Parse JSON from model output defensively: extract the first `{…}` block, `try/catch` the parse, validate the shape.
- Always wrap API routes in `try/catch` and return proper status codes (400 bad input, 401, 500, 502 upstream failure).
- API routes are behind the password gate unless the prototype is public.

### Storage
- No databases. Persist with `localStorage` via `@/lib/storage` (`readStorage`/`writeStorage`) or the `useLocalStorage(slug, key, initial)` hook.
- Wrap all `localStorage` access in try/catch (the helpers do).
- Load on mount (in an effect), never during server render.
- Namespace keys per prototype (`pg:<slug>:<key>`; the helpers do).

### Thumbnails
- New prototype or any visual change → `pnpm thumbnails <slug>` and commit the images **in the same commit**.
- Global style change (tokens, fonts, layout chrome) → `pnpm thumbnails` (all).
- **Open and check the captured images before committing.** A stale or broken thumbnail is worse than none. If the prototype needs time or interaction to look good, use `--delay`, or render a good-looking idle/demo state by default.
- Missing thumbnails show a "No preview yet" tile; that's fine, never block a build on them.

### Privacy and public prototypes
- The whole site is password-gated in production (`PLAYGROUND_PASSWORD` env var). Everything is **private by default**.
- **Only set `"public": true` when the owner explicitly asks for that specific prototype.** Never make anything public on your own initiative.
- Public prototypes are served at `/p/<slug>` without a password. Unknown/private slugs 404 there (never a login redirect).
- When making a prototype public, you **must** also create its share media: run `pnpm thumbnails <slug>`, which captures `public/og/<slug>.png` (1200×630) and `public/og/<slug>.mp4` (needs `ffmpeg`). Check both, commit them, and post the `/p/<slug>` link. The page's `og:image` / `og:video` tags pick them up on the next build.
- When making a prototype private again, delete its `public/og/<slug>.*` files (the thumbnail script also removes stale ones), because `/og/*` is served without auth.
- If a public prototype has API routes, they're reachable without auth at `/api/<slug>/…`. Make sure they're safe to expose (rate limits, no secrets in responses).

---

## Workflow rules

- **Work on a branch**, push, and **open a pull request** when done. The PR triggers a build check and a Vercel preview deployment. Never push directly to `main`.
- **End every task by posting the preview link** so the owner can open the prototype straight from their phone.
- **Before finishing, run `pnpm check`** (lint, type-check, production build). Don't hand off red builds.
- Verify visually (Playwright screenshots at 375px and desktop, light and dark). Don't claim something works without looking at it.
- **When something goes wrong and gets fixed, add the lesson to the *Lessons* section below** in the same PR. This file should grow over time.

---

## Suggested libraries

Already installed: shadcn/ui (all), `lucide-react`, `next-themes`, `matter-js`, `tone`, `three`, `@react-three/fiber`, `@react-three/drei`, `playwright`, `recharts` (via chart component).

| Need | Suggestions |
|---|---|
| 3D / WebGL | three.js, React Three Fiber, drei |
| Physics | Matter.js (2D, installed), Rapier |
| Charts | Recharts, or plain SVG for sparklines |
| Maps | MapLibre GL |
| Text layout / typography effects | `@chenglou/pretext` |
| Audio / synths | Web Audio API, Tone.js (installed) |
| AI | Anthropic SDK (or AI SDK), server-side only |
| Generated UI from JSON | json-render or similar |
| Browser automation | Playwright (thumbnails, visual checks, demo videos) |
| Native app wrapper | Capacitor, if a prototype graduates to the App Store |

---

## Lessons

Add a dated bullet whenever something breaks and gets fixed.

- **2026-11-21, Cache Components is off on purpose.** With `cacheComponents: true`, `generateStaticParams` may not return `[]`, so `/p/[slug]` fails the build when nothing is public, and `Date.now()`/`Math.random()` in server code become build errors. Don't re-enable it without solving both.
- **2026-11-21, shadcn Drawer height.** The drawer's own `data-[vaul-drawer-direction=bottom]:max-h-[80vh]` beats a plain `max-h-*` class. Override with the same data-attribute variant.
- **2026-11-21, vendored shadcn lint.** `react-hooks/set-state-in-effect` is disabled for `components/ui/**` only. Write your own hooks with `useSyncExternalStore` or event callbacks instead of setting state in effects where possible.
- **2026-11-21, OG tags lag one build.** The registry records which `public/og/*` files exist at build time. After capturing OG media locally, rebuild before checking tags. On Vercel the PR build picks them up automatically.
