import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDnaForUser } from "@/lib/dna";
import { safeDecode } from "@/lib/url-params";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Public, read-only Anime DNA profile for a username.
 *
 * This is the JSON twin of `/dna/[username]`: the page renders it server-side,
 * while the mobile app (and any client) reads it here. It never exposes the
 * user's watchlist rows — only the derived, shareable profile.
 *
 * `getUserStats` walks the watchlist and can hit AniList, so the response is
 * cached for an hour at the edge with a two-day stale window, matching the
 * ISR revalidate on the page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: raw } = await params;
  const username = safeDecode(raw);
  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, avatar: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profile = await getDnaForUser(user.id, user.username, user.username, user.avatar);

    return NextResponse.json(
      { profile },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=172800",
        },
      }
    );
  } catch (e) {
    logError(e);
    return NextResponse.json({ error: "Could not build Anime DNA" }, { status: 500 });
  }
}
