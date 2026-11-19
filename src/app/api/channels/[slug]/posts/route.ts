import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";
import {
  aggregateReactions,
  isHttpUrl,
  toChannelPostView,
  type ChannelPostRow,
} from "@/lib/social-types";

export const dynamic = "force-dynamic";

type Context = RouteContext<'/api/channels/[slug]/posts'>;

const postSelect = {
  id: true,
  channelId: true,
  content: true,
  imageUrl: true,
  linkUrl: true,
  linkLabel: true,
  pinned: true,
  createdAt: true,
  author: { select: { id: true, username: true, avatar: true, bio: true } },
} satisfies Prisma.ChannelPostSelect;

export async function GET(req: NextRequest, ctx: Context) {
  const { slug } = await ctx.params;
  const session = await auth();
  const viewerId = session?.user?.id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100);
  const cursor = searchParams.get("cursor");

  try {
    const channel = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    const cursorRow = cursor
      ? await prisma.channelPost.findFirst({
          where: { id: cursor, channelId: channel.id },
          select: { id: true },
        })
      : null;

    const rows = await prisma.channelPost.findMany({
      where: { channelId: channel.id },
      select: postSelect,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursorRow ? { cursor: { id: cursorRow.id }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const reactionRows = await prisma.channelPostReaction.findMany({
      where: { postId: { in: page.map((post) => post.id) } },
      select: { postId: true, emoji: true, userId: true },
    });
    const byPost = new Map<string, { emoji: string; userId: string }[]>();
    for (const reaction of reactionRows) {
      const list = byPost.get(reaction.postId) ?? [];
      list.push({ emoji: reaction.emoji, userId: reaction.userId });
      byPost.set(reaction.postId, list);
    }

    const posts = page.map((post: ChannelPostRow) =>
      toChannelPostView(
        post,
        aggregateReactions(byPost.get(post.id) ?? [], viewerId),
        viewerId === channel.ownerId || viewerId === post.author.id
      )
    );

    return NextResponse.json({
      posts,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Context) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  try {
    const channel = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    if (channel.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Only the channel owner can post" }, { status: 403 });
    }

    const body = await req.json().catch(() => null) as {
      content?: unknown;
      imageUrl?: unknown;
      linkUrl?: unknown;
      linkLabel?: unknown;
      pinned?: unknown;
    } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (content.length < 1 || content.length > 2000) {
      return NextResponse.json(
        { error: "Content must be between 1 and 2000 characters" },
        { status: 400 }
      );
    }

    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    const linkUrl = typeof body?.linkUrl === "string" ? body.linkUrl.trim() : "";
    if (imageUrl && !isHttpUrl(imageUrl)) {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }
    if (linkUrl && !isHttpUrl(linkUrl)) {
      return NextResponse.json({ error: "Invalid link URL" }, { status: 400 });
    }
    const linkLabel =
      typeof body?.linkLabel === "string" ? body.linkLabel.trim().slice(0, 100) || null : null;

    const post = await prisma.channelPost.create({
      data: {
        channelId: channel.id,
        authorId: session.user.id,
        content,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        linkLabel,
        pinned: body?.pinned === true,
      },
      select: postSelect,
    });

    return NextResponse.json({
      post: toChannelPostView(post, { reactions: {}, myReactions: [] }, true),
    });
  } catch {
    return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
  }
}
