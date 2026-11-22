import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { getIdentityFromBearerToken, revokeUserSessions } from "@/lib/session-token";

export const dynamic = "force-dynamic";

const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

/**
 * Server-side logout.
 *
 * Bumping `User.tokenVersion` invalidates every JWT already issued to this
 * account, including the one held by the APK, instead of only deleting it from
 * the local device. The request is idempotent and always returns ok so callers
 * can clear local state even when the network is unavailable.
 */
export async function POST(request: Request) {
  let userId: string | null = null;

  try {
    const bearer = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim();
    if (bearer) {
      const identity = await getIdentityFromBearerToken(bearer);
      userId = identity?.id ?? null;
    }

    if (!userId) {
      const session = await auth();
      userId = session?.user?.id ?? null;
    }

    if (userId) {
      await revokeUserSessions(userId, "explicit_logout");
    }
  } catch (error) {
    logError(error, "auth.logout");
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
  for (const name of SESSION_COOKIES) response.cookies.delete(name);
  return response;
}
