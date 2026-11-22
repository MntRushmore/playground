import type { PrototypeSummary } from "./prototype-types";

export type GalleryFilter = { query: string; tag: string | null; showHidden: boolean };

/** Pure filter for the homepage gallery. Input is already sorted by updatedAt desc. */
export function filterPrototypes(items: PrototypeSummary[], f: GalleryFilter) {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((p) => {
    if (p.hidden && !f.showHidden) return false;
    if (f.tag && !p.tags.includes(f.tag)) return false;
    if (terms.length === 0) return true;
    const haystack = [p.title, p.description, p.slug, ...p.tags].join(" ").toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/** Tags across visible prototypes, most used first. */
export function collectTags(items: PrototypeSummary[], showHidden: boolean) {
  const counts = new Map<string, number>();
  for (const p of items) {
    if (p.hidden && !showHidden) continue;
    for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
