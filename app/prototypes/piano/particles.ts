// Little notes, stars and hearts that float up from a pressed key.
// Imperative DOM + Web Animations (compositor-only transform/opacity), so React never re-renders for them.

import { MAX_PARTICLES, PARTICLE_SHAPES } from "./data";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Spawn one shape at (x, y), in `layer`'s coordinates, colored like its key. */
export function spawnParticle(layer: HTMLElement, x: number, y: number, color: string, rand = Math.random) {
  while (layer.childElementCount >= MAX_PARTICLES) layer.firstElementChild?.remove();

  const size = 22 + rand() * 18;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.left = `${x - size / 2}px`;
  svg.style.top = `${y - size / 2}px`;
  svg.style.overflow = "visible";
  svg.style.willChange = "transform, opacity";

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", PARTICLE_SHAPES[Math.floor(rand() * PARTICLE_SHAPES.length)]);
  // Content color: the key's own color, with a pale outline so it reads on top of keys.
  path.style.fill = color;
  path.style.stroke = `color-mix(in oklch, ${color} 18%, white)`;
  path.setAttribute("stroke-width", "2.4");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("paint-order", "stroke");
  svg.appendChild(path);
  layer.appendChild(svg);

  const rise = 110 + rand() * 150;
  const drift = (rand() - 0.5) * 90;
  const spin0 = (rand() - 0.5) * 40;
  const spin1 = spin0 + (rand() - 0.5) * 70;
  const duration = 1300 + rand() * 600;
  // Motion decelerates smoothly (ease-out-quint) …
  svg.animate(
    [
      { transform: `translate(0, 0) scale(0.3) rotate(${spin0}deg)` },
      { transform: `translate(${drift * 0.2}px, ${-rise * 0.25}px) scale(1.05) rotate(${spin0}deg)`, offset: 0.12 },
      { transform: `translate(${drift}px, ${-rise}px) scale(0.8) rotate(${spin1}deg)` },
    ],
    { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
  );
  // … while opacity runs on its own linear clock, so shapes stay solid until the end.
  const fade = svg.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.06 },
      { opacity: 1, offset: 0.55 },
      { opacity: 0 },
    ],
    { duration, easing: "linear", fill: "forwards" }
  );
  fade.onfinish = () => svg.remove();
  fade.oncancel = () => svg.remove();
}
