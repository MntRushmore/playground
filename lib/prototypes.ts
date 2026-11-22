import "server-only";
import type { PrototypeSummary, RegistryEntry } from "./prototype-types";
import { registry } from "./registry.generated";

function toSummary(entry: RegistryEntry): PrototypeSummary {
  const m = entry.metadata;
  return {
    slug: entry.slug,
    title: m.title ?? entry.slug,
    description: m.description ?? "",
    tags: Array.isArray(m.tags) ? m.tags : [],
    createdAt: m.createdAt ?? "",
    updatedAt: m.updatedAt ?? m.createdAt ?? "",
    hidden: m.hidden === true,
    public: m.public === true,
    thumbnail: entry.assets.thumbnail
      ? {
          light: `/thumbnails/${entry.slug}-light.jpg`,
          dark: `/thumbnails/${entry.slug}-dark.jpg`,
        }
      : null,
  };
}

function time(iso: string) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Every prototype (including hidden), most recently updated first. */
export function getAllPrototypes(): PrototypeSummary[] {
  return registry.map(toSummary).sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

export function getPrototype(slug: string): PrototypeSummary | null {
  const entry = registry.find((e) => e.slug === slug);
  return entry ? toSummary(entry) : null;
}

/** Only prototypes explicitly flagged `"public": true`. */
export function getPublicPrototypes(): PrototypeSummary[] {
  return getAllPrototypes().filter((p) => p.public);
}

/** Registry entry for a public slug, or null for unknown/private slugs. */
export function getPublicEntry(slug: string): RegistryEntry | null {
  const entry = registry.find((e) => e.slug === slug);
  return entry && entry.metadata.public === true ? entry : null;
}
