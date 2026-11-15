import { prisma } from "@/lib/prisma";

/**
 * "Vibe" — what the ZyniVerse community is watching right now.
 *
 * Privacy-first by design: everything here is an aggregate. We count titles,
 * episodes and rooms, and we never return a username, a user id, or a
 * per-person watchlist. Nothing new is stored — this is a read-only roll-up of
 * rows that already exist (`Activity`, `WatchParty`, `WatchPartyMember`).
 */

const WATCH_TYPES = ["WATCHING", "CURRENT", "WATCHED_EPISODE", "COMPLETED"];
const WINDOW_DAYS = 7;
const MAX_ACTIVITY_ROWS = 1500;

export interface VibeTitle {
  mediaId: number;
  title: string;
  image: string | null;
  fans: number;
  events: number;
  lastSeen: string;
}

export interface VibeLiveRoom {
  id: string;
  mediaId: number;
  title: string;
  image: string | null;
  episode: number;
  members: number;
}

export interface VibeSnapshot {
  generatedAt: string;
  windowDays: number;
  pulse: {
    fans: number;
    titles: number;
    episodes: number;
    liveRooms: number;
    inRooms: number;
  };
  nowWatching: VibeTitle[];
  liveRooms: VibeLiveRoom[];
}

interface TitleAgg {
  mediaId: number;
  title: string;
  image: string | null;
  events: number;
  lastSeen: number;
  fans: Set<string>;
}

export async function getVibeSnapshot(): Promise<VibeSnapshot> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);

  const [rows, liveParties, memberRows] = await Promise.all([
    prisma.activity.findMany({
      where: {
        createdAt: { gte: since },
        mediaId: { not: null },
        type: { in: WATCH_TYPES },
      },
      select: {
        userId: true,
        mediaId: true,
        mediaTitle: true,
        mediaImage: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ACTIVITY_ROWS,
    }),
    prisma.watchParty.findMany({
      where: { status: "live" },
      select: {
        id: true,
        mediaId: true,
        mediaTitle: true,
        mediaImage: true,
        coverImage: true,
        episode: true,
        updatedAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.watchPartyMember.findMany({
      where: { party: { status: "live" } },
      select: { userId: true },
    }),
  ]);

  const titles = new Map<number, TitleAgg>();
  let episodes = 0;

  for (const row of rows) {
    if (!row.mediaId) continue;
    if (row.type === "WATCHED_EPISODE") episodes += 1;

    const seen = row.createdAt.getTime();
    const existing = titles.get(row.mediaId);
    if (existing) {
      existing.events += 1;
      existing.fans.add(row.userId);
      existing.lastSeen = Math.max(existing.lastSeen, seen);
      if (!existing.title && row.mediaTitle) existing.title = row.mediaTitle;
      if (!existing.image && row.mediaImage) existing.image = row.mediaImage;
    } else {
      titles.set(row.mediaId, {
        mediaId: row.mediaId,
        title: row.mediaTitle || `Anime #${row.mediaId}`,
        image: row.mediaImage || null,
        events: 1,
        lastSeen: seen,
        fans: new Set([row.userId]),
      });
    }
  }

  const nowWatching: VibeTitle[] = [...titles.values()]
    .map((t) => ({
      mediaId: t.mediaId,
      title: t.title,
      image: t.image,
      fans: t.fans.size,
      events: t.events,
      lastSeen: new Date(t.lastSeen).toISOString(),
    }))
    .sort((a, b) => b.fans - a.fans || b.events - a.events || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, 12);

  const uniqueFans = new Set(rows.map((r) => r.userId)).size;
  const inRooms = new Set(memberRows.map((m) => m.userId)).size;

  return {
    generatedAt: new Date().toISOString(),
    windowDays: WINDOW_DAYS,
    pulse: {
      fans: uniqueFans,
      titles: titles.size,
      episodes,
      liveRooms: liveParties.length,
      inRooms,
    },
    nowWatching,
    liveRooms: liveParties.map((p) => ({
      id: p.id,
      mediaId: p.mediaId,
      title: p.mediaTitle,
      image: p.coverImage || p.mediaImage || null,
      episode: p.episode,
      members: p._count.members,
    })),
  };
}
