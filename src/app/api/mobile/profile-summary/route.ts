import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/resolve-user";

/**
 * Lightweight profile payload for the native app.
 *
 * The full `/api/profile` route also loads reviews, achievements, activity and
 * point history. Those tabs are secondary on mobile, so the first paint uses
 * this single-query summary and the full profile is fetched afterwards in the
 * background. The response shape intentionally matches `ProfileResponse`.
 */
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
};

export async function GET() {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const [user, userPoints] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          banner: true,
          themeColor: true,
          signature: true,
          bio: true,
          createdAt: true,
          entries: {
            select: {
              mediaId: true,
              type: true,
              status: true,
              progress: true,
              total: true,
              score: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" as const },
            take: 100,
          },
          _count: { select: { followers: true, following: true } },
        },
      }),
      prisma.userPoints.findUnique({ where: { userId } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    }

    const entries = user.entries;
    const scored = entries.filter((entry) => entry.score && entry.score > 0);
    const stats = {
      total: entries.length,
      current: entries.filter((entry) => entry.status === "CURRENT").length,
      planning: entries.filter((entry) => entry.status === "PLANNING").length,
      completed: entries.filter((entry) => entry.status === "COMPLETED").length,
      dropped: entries.filter((entry) => entry.status === "DROPPED").length,
      paused: entries.filter((entry) => entry.status === "PAUSED").length,
      episodesWatched: entries.reduce((sum, entry) => sum + (entry.progress || 0), 0),
      meanScore:
        scored.length === 0
          ? 0
          : Math.round((scored.reduce((sum, entry) => sum + (entry.score || 0), 0) / scored.length) * 10) / 10,
    };

    const topAnime = entries
      .filter((entry) => entry.type === "ANIME" && entry.status === "COMPLETED" && entry.score && entry.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map((entry) => ({ mediaId: entry.mediaId, score: entry.score, title: null, cover: null }));

    return NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          banner: user.banner,
          themeColor: user.themeColor,
          signature: user.signature,
          bio: user.bio,
          createdAt: user.createdAt,
          entries,
          reviews: [],
          followersCount: user._count.followers,
          followingCount: user._count.following,
          level: userPoints?.level ?? 1,
          points: userPoints?.points ?? 0,
          achievements: [],
          recentActivity: [],
        },
        stats,
        topAnime,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("[/api/mobile/profile-summary] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE }
    );
  }
}
