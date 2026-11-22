import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isGateEnabled, isValidSession } from "@/lib/auth";
import { publicSlugs } from "@/lib/public-slugs.generated";

// Password gate. Everything is private unless listed here.
function isPublicPath(pathname: string) {
  if (pathname === "/login" || pathname === "/api/auth") return true;
  if (pathname === "/robots.txt") return true;
  // Public prototype pages. Unknown/private slugs 404 inside the route (no login redirect,
  // so private names never leak).
  if (pathname === "/p" || pathname.startsWith("/p/")) return true;
  // API routes belonging to a public prototype: /api/<public-slug>/...
  const api = pathname.match(/^\/api\/([^/]+)(\/|$)/);
  if (api && publicSlugs.includes(api[1])) return true;
  // Thumbnails of public prototypes (used as OG fallback). Private thumbnails stay gated.
  const thumb = pathname.match(/^\/thumbnails\/(.+)-(light|dark)\.jpg$/);
  if (thumb && publicSlugs.includes(thumb[1])) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip framework assets and public OG media (only public prototypes have files there).
  // Thumbnails are NOT skipped: they would leak private prototypes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|og/).*)"],
};
