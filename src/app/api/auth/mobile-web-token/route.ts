import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { createWebBridgeToken } from "@/lib/mobile-web-bridge";

export const dynamic = "force-dynamic";

/**
 * Mints a two-minute token that the mobile WebView can exchange for the
 * current session at `/auth/mobile-web`.
 *
 * Only reachable with a real session — it never creates one.
 */

const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const jar = await cookies();
  const pairs: string[] = [];
  for (const name of SESSION_COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (value) pairs.push(`${name}=${value}`);
  }

  if (pairs.length === 0) {
    return NextResponse.json({ ok: false, error: "No session cookie" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true, token: createWebBridgeToken(pairs.join("; ")) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
