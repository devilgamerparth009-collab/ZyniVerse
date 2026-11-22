import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DiscoveredUser } from "@/lib/social-types";
import { toPublicUser } from "@/lib/social-types";

export const dynamic = "force-dynamic";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 24, 1), 50);

  try {
    const [myEntries, myFollows, myFollowers, friendRequests, officialChannels] =
      await Promise.all([
        prisma.listEntry.findMany({
          where: { userId },
          select: { mediaId: true },
        }),
        prisma.follow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        }),
        prisma.follow.findMany({
          where: { followingId: userId },
          select: { followerId: true },
        }),
        prisma.friendRequest.findMany({
          where: { OR: [{ senderId: userId }, { receiverId: userId }], status: "accepted" },
          select: { senderId: true, receiverId: true },
        }),
        prisma.broadcastChannel.findMany({
          take: 500,
          where: { isOfficial: true },
          select: { ownerId: true },
        }),
      ]);

    const myMediaIds = new Set(myEntries.map((entry) => entry.mediaId));
    const followingIds = new Set(myFollows.map((follow) => follow.followingId));
    const followerIds = new Set(myFollowers.map((follow) => follow.followerId));
    const friendIds = new Set(
      friendRequests.map((request) =>
        request.senderId === userId ? request.receiverId : request.senderId
      )
    );
    const officialIds = new Set(officialChannels.map((channel) => channel.ownerId));

    // A bounded candidate pool keeps this O(users) rather than O(users x follows).
    // Newest users are always part of it, so discovery is never empty when the
    // app has other members.
    const candidates = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        lastSeen: true,
        createdAt: true,
        entries: { select: { mediaId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const candidateIds = candidates.map((candidate) => candidate.id);
    const candidateDates = new Map(
      candidates.map((candidate) => [
        candidate.id,
        (candidate.lastSeen ?? candidate.createdAt).getTime(),
      ])
    );
    const mutualRows = await prisma.follow.findMany({
      take: 500,
      where: {
        followingId: { in: candidateIds },
        followerId: { in: [...followerIds] },
      },
      select: { followingId: true },
    });
    const mutualCounts = new Map<string, number>();
    for (const row of mutualRows) {
      mutualCounts.set(row.followingId, (mutualCounts.get(row.followingId) ?? 0) + 1);
    }

    const sharedMediaByUser = new Map<string, number>();
    const titleIds = new Set<number>();
    for (const candidate of candidates) {
      const shared = candidate.entries.find((entry) => myMediaIds.has(entry.mediaId));
      if (shared) {
        sharedMediaByUser.set(candidate.id, shared.mediaId);
        titleIds.add(shared.mediaId);
      }
    }

    const titleRows = titleIds.size
      ? await prisma.activity.findMany({
          take: 500,
          where: { mediaId: { in: [...titleIds] }, mediaTitle: { not: null } },
          select: { mediaId: true, mediaTitle: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const titles = new Map<number, string>();
    for (const row of titleRows) {
      if (row.mediaId !== null && row.mediaTitle && !titles.has(row.mediaId)) {
        titles.set(row.mediaId, row.mediaTitle);
      }
    }

    const now = Date.now();
    const discovered: DiscoveredUser[] = candidates.map((candidate) => {
      const sharedMediaId = sharedMediaByUser.get(candidate.id);
      const mutualFollowers = mutualCounts.get(candidate.id) ?? 0;
      const isFriend = friendIds.has(candidate.id);
      const recentlyActive =
        candidate.lastSeen !== null && now - candidate.lastSeen.getTime() < RECENT_WINDOW_MS;

      let reason: string;
      if (officialIds.has(candidate.id)) {
        reason = "ZyniVerse team";
      } else if (sharedMediaId !== undefined) {
        const title = titles.get(sharedMediaId);
        reason = title ? `Watches ${title}` : "Shares your watchlist";
      } else if (isFriend) {
        reason = "Your friend";
      } else if (mutualFollowers > 0) {
        reason = "Mutual followers";
      } else if (recentlyActive) {
        reason = "Recently active";
      } else {
        reason = "New here";
      }

      return {
        ...toPublicUser({
          id: candidate.id,
          username: candidate.username,
          avatar: candidate.avatar,
          bio: candidate.bio,
        }),
        isFollowing: followingIds.has(candidate.id),
        isFriend,
        mutualFollowers,
        reason,
      };
    });

    discovered.sort((a, b) => {
      const score = (user: DiscoveredUser) =>
        (sharedMediaByUser.has(user.id) ? 100 : 0) +
        (mutualCounts.get(user.id) ?? 0) * 20 +
        (user.isFriend ? 15 : 0) +
        (user.reason === "Recently active" ? 5 : 0);
      const difference = score(b) - score(a);
      if (difference !== 0) return difference;
      const aDate = candidateDates.get(a.id) ?? 0;
      const bDate = candidateDates.get(b.id) ?? 0;
      return bDate - aDate;
    });

    return NextResponse.json({ users: discovered.slice(0, limit) });
  } catch {
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }
}
