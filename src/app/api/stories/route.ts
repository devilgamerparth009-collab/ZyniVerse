import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";
import { isHttpUrl, storySelect, toStoryItem } from "@/lib/social-types";
import { ensureOfficialChannel } from "@/lib/social-seed";

export const dynamic = "force-dynamic";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const session = await auth();
  const viewerId = session?.user?.id;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 60, 1), 120);

  try {
    // Best effort: creates the official channel + welcome story on a fresh DB
    // so Stories has real content the first time it is opened.
    await ensureOfficialChannel();
  } catch {
    // The seed must never block the feed.
  }

  try {
    const rows = await prisma.story.findMany({
      take: 500,
      where: { expiresAt: { gt: new Date() } },
      select: storySelect(viewerId),
      orderBy: { createdAt: "desc" },
    });

    // Unseen stories first, newest first inside each group.
    rows.sort((a, b) => {
      const viewedDifference = Number(a.views.length > 0) - Number(b.views.length > 0);
      return viewedDifference || b.createdAt.getTime() - a.createdAt.getTime();
    });

    return NextResponse.json({ stories: rows.slice(0, limit).map((row) => toStoryItem(row, viewerId)) });
  } catch {
    return NextResponse.json({ error: "Failed to load stories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    mediaUrl?: unknown;
    mediaType?: unknown;
    caption?: unknown;
    channelId?: unknown;
  } | null;
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  if (!mediaUrl || !isHttpUrl(mediaUrl)) {
    return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
  }

  const mediaType = typeof body?.mediaType === "string" ? body.mediaType : "image";
  if (mediaType !== "image" && mediaType !== "video") {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  const caption = typeof body?.caption === "string" ? body.caption.trim().slice(0, 240) || null : null;
  const channelId = typeof body?.channelId === "string" && body.channelId ? body.channelId : null;

  try {
    if (channelId) {
      const channel = await prisma.broadcastChannel.findUnique({
        where: { id: channelId },
        select: { ownerId: true },
      });
      if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      if (channel.ownerId !== session.user.id) {
        return NextResponse.json({ error: "Only the channel owner can post to it" }, { status: 403 });
      }
    }

    const story = await prisma.story.create({
      data: {
        userId: session.user.id,
        channelId,
        mediaUrl,
        mediaType,
        caption,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
      select: storySelect(session.user.id),
    });
    return NextResponse.json({ story: toStoryItem(story, session.user.id) });
  } catch {
    return NextResponse.json({ error: "Failed to create story" }, { status: 500 });
  }
}
