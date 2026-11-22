import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, getPassword, safeEqual, sessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const password = getPassword();
    if (!password) {
      return NextResponse.json(
        { error: "PLAYGROUND_PASSWORD is not set on the server." },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const attempt = typeof body?.password === "string" ? body.password : "";

    // Compare hashes, not raw strings, so length doesn't leak.
    const [given, expected] = await Promise.all([sessionToken(attempt), sessionToken(password)]);
    if (!safeEqual(given, expected)) {
      await new Promise((r) => setTimeout(r, 400)); // slow down guessing
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, expected, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("[auth] login failed", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
