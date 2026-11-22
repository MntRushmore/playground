# Playground

A personal prototype playground: one Next.js app holding many small, self-contained prototypes. New prototypes are made by asking a coding agent; every rule it follows is in [`CLAUDE.md`](./CLAUDE.md).

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # for thumbnails
pnpm dev                                # http://localhost:3000 (no password in dev)
```

`ffmpeg` is needed for og:video capture (`brew install ffmpeg`).

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel (framework: Next.js, defaults are fine).
2. Set `PLAYGROUND_PASSWORD` for **Production and Preview** (`vercel env add PLAYGROUND_PASSWORD`).
   Without it, the site stays locked. That's deliberate.
3. Optional: `NEXT_PUBLIC_SITE_URL=https://your-domain` so OG links use your custom domain.
4. Every PR gets a preview deployment. Open it from your phone.

Tip: Vercel's own Deployment Protection also gates previews. Either keep it (double gate) or turn it off for previews so the playground password is the only gate.

## Making a prototype

Ask your agent, e.g. *"Make a prototype of a fullscreen purple piano for kids with big keys."* It follows `CLAUDE.md`: new folder in `app/prototypes/<slug>/`, metadata, docs, thumbnails, PR, preview link.

## Making one public

Ask explicitly: *"Make flow-field public."* It gets a password-free URL at `/p/<slug>` with an OG image and video.
