// 2D stand-in for the three.js render when WebGL isn't available: overlapping shaded
// lobes and a simple stem. Plainer, but carving and lighting still work on top of it.

import { rgba } from "./color";
import { ROUND_DIMS } from "./data";
import { makePlateCanvases, type PlateParams } from "./pumpkin-render";
import { faceTransform, setFaceTransform } from "./space";
import type { Rgb } from "./types";

const hsl = (c: readonly number[], dl = 0) =>
  `hsl(${c[0] * 360} ${c[1] * 100}% ${Math.max(0, Math.min(100, (c[2] + dl) * 100))}%)`;

function paint(ctx: CanvasRenderingContext2D, p: PlateParams, night: boolean, part: "body" | "stem") {
  const ft = faceTransform(p.shape, p.size);
  ctx.clearRect(0, 0, p.size, p.size);
  setFaceTransform(ctx, ft);
  // Face units are round-pumpkin units; the transform stretches them to this shape.
  const ax = ROUND_DIMS.a;
  const by = ROUND_DIMS.b;
  if (part === "stem") {
    ctx.fillStyle = night ? "#1d2414" : "#5b6b33";
    ctx.beginPath();
    ctx.ellipse(0.02, -by * 0.95, 0.08, 0.18, 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const n = Math.round(p.ribs);
    for (let i = n - 1; i >= 0; i--) {
      const t = (i / (n - 1)) * 2 - 1;
      const order = Math.abs(t);
      ctx.save();
      ctx.translate(t * ax * 0.55, 0);
      const g = ctx.createRadialGradient(-0.15, -0.3, 0.05, 0, 0, by * 1.1);
      g.addColorStop(0, hsl(p.palette.base, 0.12 - order * 0.1));
      g.addColorStop(1, hsl(p.palette.crease, -0.05));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, ax * (0.5 - order * 0.12), by, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (night) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = rgba([10, 12, 30] as Rgb, 0.72);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.globalCompositeOperation = "source-over";
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function renderFallbackPlates(p: PlateParams) {
  const plates = makePlateCanvases(p.size);
  paint(plates.bodyDay.getContext("2d")!, p, false, "body");
  paint(plates.bodyNight.getContext("2d")!, p, true, "body");
  paint(plates.stemDay.getContext("2d")!, p, false, "stem");
  paint(plates.stemNight.getContext("2d")!, p, true, "stem");
  return plates;
}
