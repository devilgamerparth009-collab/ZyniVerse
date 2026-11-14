import { NextRequest, NextResponse } from "next/server";
import { readWebBridgeToken } from "@/lib/mobile-web-bridge";

/**
 * Exchanges a `/api/auth/mobile-web-token` token for the real NextAuth cookie
 * inside the in-app WebView, then continues to `next`.
 *
 * The app signs in with `fetch()`, so its session never reaches the WebView's
 * cookie jar. After this hop the WebView owns a normal cookie and every later
 * navigation — chat, watch party, voice — is authenticated on its own.
 *
 * `next` is validated to be a same-origin path so this can never act as an
 * open redirect.
 */

const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const token = url.searchParams.get("t");

  const cookie = token ? readWebBridgeToken(token) : null;
  if (!cookie) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, url.origin),
      302,
    );
  }

  const response = NextResponse.redirect(new URL(next, url.origin), 302);
  let copied = false;

  for (const pair of cookie.split(";")) {
    const trimmed = pair.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq);
    if (!SESSION_COOKIE_NAMES.includes(name)) continue;
    const value = trimmed.slice(eq + 1);
    if (!value) continue;

    response.cookies.set(name, value, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    copied = true;
  }

  if (!copied) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(next)}`, url.origin),
      302,
    );
  }

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
