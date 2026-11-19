import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";
import { aggregateReactions, stripControlChars } from "@/lib/social-types";

export const dynamic = "force-dynamic";

type Context = RouteContext<'/api/channels/[slug]/posts/[postId]/react'>;

export async function POST(req: NextRequest, ctx: Context) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, postId } = await ctx.params;
  const body = await req.json().catch(() => null) as { emoji?: unknown } | null;
  const emoji = typeof body?.emoji === "string" ? stripControlChars(body.emoji) : "";
  if (!emoji || emoji.length > 16) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  try {
    const channel = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    const post = await prisma.channelPost.findFirst({
      where: { id: postId, channelId: channel.id },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const key = { postId: post.id, userId: session.user.id, emoji };
    const existing = await prisma.channelPostReaction.findUnique({
      where: { postId_userId_emoji: key },
      select: { id: true },
    });
    if (existing) {
      await prisma.channelPostReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.channelPostReaction.create({ data: key });
    }

    const rows = await prisma.channelPostReaction.findMany({
      where: { postId: post.id },
      select: { emoji: true, userId: true },
    });
    return NextResponse.json(aggregateReactions(rows, session.user.id));
  } catch {
    return NextResponse.json({ error: "Failed to react" }, { status: 500 });
  }
}
