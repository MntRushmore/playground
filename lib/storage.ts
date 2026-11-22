// Safe, namespaced localStorage helpers. Every prototype uses these instead of
// touching window.localStorage directly. Call them from effects/handlers only
// (never during render), so server rendering never sees them.

const PREFIX = "pg";

export function storageKey(slug: string, key: string) {
  return `${PREFIX}:${slug}:${key}`;
}

export function readStorage<T>(slug: string, key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey(slug, key));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(slug: string, key: string, value: T) {
  try {
    window.localStorage.setItem(storageKey(slug, key), JSON.stringify(value));
  } catch {
    // Quota exceeded, private mode, or disabled storage: ignore.
  }
}

export function removeStorage(slug: string, key: string) {
  try {
    window.localStorage.removeItem(storageKey(slug, key));
  } catch {
    // ignore
  }
}
