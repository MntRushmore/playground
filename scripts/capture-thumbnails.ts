#!/usr/bin/env tsx
/**
 * Capture static gallery thumbnails (light + dark) and, for public prototypes,
 * Open Graph media (1200×630 PNG + short MP4).
 *
 *   pnpm thumbnails                       # every prototype
 *   pnpm thumbnails flow-field other-one  # just these
 *   pnpm thumbnails --missing             # only prototypes without thumbnails (or missing OG media if public)
 *   pnpm thumbnails --skip-build          # reuse the existing .next build
 *   pnpm thumbnails --delay 4000          # wait longer before capturing (default 2000ms)
 *   pnpm thumbnails --no-og               # skip OG capture
 *
 * Output:
 *   public/thumbnails/<slug>-light.jpg, <slug>-dark.jpg   (640×400)
 *   public/og/<slug>.png, <slug>.mp4                      (public prototypes only)
 *
 * It builds for production, starts `next start` with a throwaway password, and logs
 * in by setting the session cookie directly. Always LOOK at the images afterwards.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContextOptions } from "playwright";
import { SESSION_COOKIE, sessionToken } from "../lib/auth";
import { discoverPrototypes, generateRegistry } from "./generate-registry.mjs";

const ROOT = path.resolve(__dirname, "..");
const THUMBS = path.join(ROOT, "public", "thumbnails");
const OG = path.join(ROOT, "public", "og");
const TMP = path.join(ROOT, ".thumbs-tmp");

type Args = {
  slugs: string[];
  missing: boolean;
  skipBuild: boolean;
  og: boolean;
  delay: number;
  port: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { slugs: [], missing: false, skipBuild: false, og: true, delay: 2000, port: 3210 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--missing") args.missing = true;
    else if (a === "--skip-build") args.skipBuild = true;
    else if (a === "--no-og") args.og = false;
    else if (a === "--delay") args.delay = Number(argv[++i]);
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a.startsWith("--")) throw new Error(`Unknown flag ${a}`);
    else args.slugs.push(a);
  }
  return args;
}

function hasFfmpeg() {
  return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

/** Downscale a 2× PNG to a crisp JPEG at the target size (Lanczos). Removes the source PNG. */
function encodeThumb(src: string, dest: string, width: number, height: number) {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", src, "-vf", `scale=${width}:${height}:flags=lanczos`, "-q:v", "2", dest],
    { stdio: "inherit" }
  );
  fs.rmSync(src, { force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed encoding ${dest}`);
}

async function waitForServer(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start at ${url}`);
}

function startServer(port: number, password: string): ChildProcess {
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, PLAYGROUND_PASSWORD: password, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));
  return child;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = discoverPrototypes();
  const known = new Set(all.map((p) => p.slug));
  for (const s of args.slugs) if (!known.has(s)) throw new Error(`Unknown prototype "${s}"`);

  // Remove OG media for prototypes that are no longer public: /og/* is served without auth.
  for (const file of fs.existsSync(OG) ? fs.readdirSync(OG) : []) {
    if (file.startsWith(".") || !/\.(png|mp4)$/.test(file)) continue; // keep .gitkeep and other files
    const slug = file.replace(/\.(png|mp4)$/, "");
    if (!all.some((p) => p.slug === slug && p.public)) {
      fs.rmSync(path.join(OG, file));
      console.log(`removed stale public OG file og/${file}`);
    }
  }

  let targets = args.slugs.length ? all.filter((p) => args.slugs.includes(p.slug)) : all;
  if (args.missing) {
    targets = targets.filter((p) => !p.thumbnail || (p.public && args.og && (!p.ogImage || !p.ogVideo)));
  }
  if (targets.length === 0) {
    console.log("Nothing to capture.");
    return;
  }
  console.log(`Capturing: ${targets.map((t) => t.slug).join(", ")}`);

  if (!args.skipBuild) {
    console.log("Building for production…");
    const build = spawnSync("pnpm", ["build"], { cwd: ROOT, stdio: "inherit" });
    if (build.status !== 0) throw new Error("Build failed");
  }

  fs.mkdirSync(THUMBS, { recursive: true });
  fs.mkdirSync(OG, { recursive: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const password = randomBytes(16).toString("hex");
  const token = await sessionToken(password);
  const base = `http://localhost:${args.port}`;
  const server = startServer(args.port, password);
  let browser: Browser | undefined;

  try {
    await waitForServer(`${base}/login`);
    browser = await chromium.launch();
    const ffmpeg = hasFfmpeg();

    const open = async (
      urlPath: string,
      theme: "light" | "dark",
      options: BrowserContextOptions
    ) => {
      const context = await browser!.newContext({ colorScheme: theme, ...options });
      await context.addCookies([{ name: SESSION_COOKIE, value: token, url: base }]);
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch {}
      }, theme);
      const page = await context.newPage();
      const res = await page.goto(`${base}${urlPath}`, { waitUntil: "networkidle" });
      if (!res || res.status() >= 400) throw new Error(`${urlPath} returned ${res?.status()}`);
      await page.waitForTimeout(args.delay);
      return { context, page };
    };

    for (const t of targets) {
      for (const theme of ["light", "dark"] as const) {
        // 1280×800 CSS px at 2× DPR → 2560×1600, downscaled to a crisp 1280×800 JPEG
        // (with ffmpeg) or saved at full 2× resolution as a fallback.
        const { context, page } = await open(`/prototypes/${t.slug}`, theme, {
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 2,
        });
        const file = path.join(THUMBS, `${t.slug}-${theme}.jpg`);
        if (ffmpeg) {
          const raw = path.join(TMP, `${t.slug}-${theme}.png`);
          await page.screenshot({ path: raw, type: "png" });
          encodeThumb(raw, file, 1280, 800);
        } else {
          await page.screenshot({ path: file, type: "jpeg", quality: 90 });
        }
        await context.close();
        console.log(`✓ thumbnails/${t.slug}-${theme}.jpg`);
      }

      if (t.public && args.og) {
        const ogPng = path.join(OG, `${t.slug}.png`);
        const { context, page } = await open(`/p/${t.slug}`, "dark", {
          viewport: { width: 1200, height: 630 },
          deviceScaleFactor: 2,
        });
        if (ffmpeg) {
          const raw = path.join(TMP, `${t.slug}-og.png`);
          await page.screenshot({ path: raw, type: "png" });
          const r = spawnSync(
            "ffmpeg",
            ["-y", "-loglevel", "error", "-i", raw, "-vf", "scale=1200:630:flags=lanczos", ogPng],
            { stdio: "inherit" }
          );
          fs.rmSync(raw, { force: true });
          if (r.status !== 0) throw new Error("ffmpeg failed encoding OG png");
        } else {
          await page.screenshot({ path: ogPng, type: "png" });
        }
        await context.close();
        console.log(`✓ og/${t.slug}.png`);

        const videoDir = path.join(TMP, t.slug);
        const rec = await open(`/p/${t.slug}`, "dark", {
          viewport: { width: 1200, height: 630 },
          recordVideo: { dir: videoDir, size: { width: 1200, height: 630 } },
        });
        await rec.page.waitForTimeout(6000);
        const video = rec.page.video();
        await rec.context.close();
        const webm = video ? await video.path() : undefined;
        if (webm && ffmpeg) {
          const out = path.join(OG, `${t.slug}.mp4`);
          const conv = spawnSync(
            "ffmpeg",
            ["-y", "-loglevel", "error", "-ss", "1.5", "-t", "6", "-i", webm,
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-movflags", "+faststart", "-an", out],
            { stdio: "inherit" }
          );
          if (conv.status === 0) console.log(`✓ og/${t.slug}.mp4`);
          else console.warn(`✗ ffmpeg failed for ${t.slug}`);
        } else if (!ffmpeg) {
          console.warn("✗ ffmpeg not found: skipping og:video (brew install ffmpeg)");
        }
      }
    }
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  generateRegistry();
  console.log("\nDone. Open the images and check them before committing.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
