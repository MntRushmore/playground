import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { generateRegistry } from "./scripts/generate-registry.mjs";

// Keep lib/registry.generated.ts in sync with app/prototypes/* on every dev start and build.
generateRegistry();

let watching = false;
function watchPrototypes() {
  if (watching) return;
  watching = true;
  const dir = path.join(process.cwd(), "app", "prototypes");
  let timer: NodeJS.Timeout | undefined;
  try {
    fs.watch(dir, { recursive: true }, (_event, file) => {
      if (!file || !/(^|[\\/])(metadata\.json|page\.tsx)$|^[^\\/]+$/.test(file)) return;
      clearTimeout(timer);
      timer = setTimeout(() => generateRegistry(), 150);
    });
  } catch {
    // Recursive watch unsupported: restart `pnpm dev` after adding a prototype.
  }
}

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) watchPrototypes();
  return {
    // Cache Components is intentionally OFF: it forbids empty generateStaticParams
    // (breaks /p/[slug] when nothing is public) and turns Date.now()/Math.random()
    // in server code into build errors. See CLAUDE.md > Lessons.
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
