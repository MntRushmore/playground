// Low-level canvas helpers for the layer pipeline: buffers, tinting, clipping, blur,
// grain. No knowledge of pumpkins.

export type Ctx = CanvasRenderingContext2D;
export type Buf = { c: HTMLCanvasElement; x: Ctx };
/** Plate-px rectangles to rebuild; null means the whole plate. */
export type Region = { x: number; y: number; w: number; h: number }[] | null;

export function buf(w: number, h = w, readable = false): Buf {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, x: c.getContext("2d", { willReadFrequently: readable })! };
}

export const clear = (b: Buf) => {
  b.x.setTransform(1, 0, 0, 1, 0, 0);
  b.x.globalAlpha = 1;
  b.x.globalCompositeOperation = "source-over";
  b.x.clearRect(0, 0, b.c.width, b.c.height);
};

/** `dst` = `mask` alpha filled with a flat color. */
export function tint(dst: Buf, mask: HTMLCanvasElement, color: string) {
  clear(dst);
  dst.x.drawImage(mask, 0, 0);
  dst.x.globalCompositeOperation = "source-in";
  dst.x.fillStyle = color;
  dst.x.fillRect(0, 0, dst.c.width, dst.c.height);
  dst.x.globalCompositeOperation = "source-over";
}

export const grow = (r: Region, by: number): Region =>
  r && r.map((q) => ({ x: q.x - by, y: q.y - by, w: q.w + by * 2, h: q.h + by * 2 }));

/** Restricts every following draw on `bufs` to the region (no-op for the whole plate). */
export function clip(bufs: Buf[], r: Region, scale = 1) {
  for (const b of bufs) {
    b.x.save();
    if (!r) continue;
    b.x.beginPath();
    for (const q of r) b.x.rect(q.x * scale, q.y * scale, q.w * scale, q.h * scale);
    b.x.clip();
  }
}
export const unclip = (bufs: Buf[]) => bufs.forEach((b) => b.x.restore());

/** Cheap blur: a few offset passes at small resolution, widening each pass. */
export function blurInPlace(b: Buf, tmp: Buf, passes: number) {
  const w = b.c.width;
  for (let p = 0; p < passes; p++) {
    const d = p + 1;
    clear(tmp);
    tmp.x.globalCompositeOperation = "lighter";
    tmp.x.globalAlpha = 1 / 5;
    for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) tmp.x.drawImage(b.c, dx, dy, w, w);
    clear(b);
    b.x.globalCompositeOperation = "lighter";
    b.x.globalAlpha = 1 / 5;
    for (const [dx, dy] of [[0, 0], [d, d], [-d, d], [d, -d], [-d, -d]]) b.x.drawImage(tmp.c, dx, dy, w, w);
    b.x.globalAlpha = 1;
    b.x.globalCompositeOperation = "source-over";
  }
}

/** Small tile of scrape marks so etched areas glow unevenly, like real thinned skin. */
export function grainTile() {
  const t = buf(96);
  let seed = 9;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  t.x.lineCap = "round";
  for (let i = 0; i < 140; i++) {
    // Short parallel scrape marks.
    const x = rand() * 96;
    const y = rand() * 96;
    const len = 2 + rand() * 6;
    t.x.strokeStyle = `rgba(0,0,0,${0.1 + rand() * 0.3})`;
    t.x.lineWidth = 0.6 + rand() * 1.1;
    t.x.beginPath();
    t.x.moveTo(x, y);
    t.x.lineTo(x + len * 0.94, y + len * 0.34);
    t.x.stroke();
  }
  return t;
}

export function applyGrain(tile: Buf, dst: Buf, alpha: number) {
  const pattern = dst.x.createPattern(tile.c, "repeat");
  if (!pattern) return;
  dst.x.globalCompositeOperation = "destination-out";
  dst.x.globalAlpha = alpha;
  dst.x.fillStyle = pattern;
  dst.x.fillRect(0, 0, dst.c.width, dst.c.height);
  dst.x.globalAlpha = 1;
  dst.x.globalCompositeOperation = "source-over";
}
