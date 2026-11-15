import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Hands the current NextAuth session cookie back to the mobile app.
 *
 * The app runs the OAuth flow inside an in-app WebView, so the session cookie
 * lives in the WebView's jar rather than the app's HTTP client. After the
 * provider redirects back, the app calls this endpoint from inside the WebView
 * and stores the returned `name=value` pair for its own API requests.
 *
 * Only reachable when a real session exists — it never mints a new one.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const jar = await cookies();
  const allCookies = jar.getAll();
  const candidates = [
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
  ];

  const pairs: string[] = [];
  for (const c of allCookies) {
    if (candidates.includes(c.name) || c.name.includes("session-token")) {
      pairs.push(`${c.name}=${c.value}`);
    }
  }

  if (pairs.length === 0) {
    return NextResponse.json({ ok: false, error: "No session cookie" }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      cookie: pairs.join("; "),
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Access-Control-Allow-Origin": "https://zyverse.in",
        "Access-Control-Allow-Credentials": "true",
      },
    }
  );
}
