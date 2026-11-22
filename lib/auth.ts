// Shared by proxy.ts, the auth API route and scripts/capture-thumbnails.ts.
// Pure Web Crypto, no Next.js imports, so it runs anywhere.

export const SESSION_COOKIE = "pg_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** The gate is on in production builds only (Vercel preview + production, `next start`). */
export function isGateEnabled() {
  return process.env.NODE_ENV === "production";
}

export function getPassword(): string | undefined {
  const pw = process.env.PLAYGROUND_PASSWORD;
  return pw && pw.length > 0 ? pw : undefined;
}

/** Deterministic session token. Changing the password invalidates every session. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`playground-session:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined) {
  const password = getPassword();
  if (!password || !cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken(password));
}
