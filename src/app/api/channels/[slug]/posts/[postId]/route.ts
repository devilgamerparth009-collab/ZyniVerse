import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

type Context = RouteContext<'/api/channels/[slug]/posts/[postId]'>;

/** Only the channel owner may pin or unpin a post. */
export async function PATCH(req: NextRequest, ctx: Context) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { pinned?: unknown } | null;
  if (typeof body?.pinned !== "boolean") {
    return NextResponse.json({ error: "pinned must be a boolean" }, { status: 400 });
  }

  const { slug, postId } = await ctx.params;
  try {
    const channel = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    if (session.user.id !== channel.ownerId) {
      return NextResponse.json({ error: "Only the channel owner can pin posts" }, { status: 403 });
    }

    const post = await prisma.channelPost.findFirst({
      where: { id: postId, channelId: channel.id },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const updated = await prisma.channelPost.update({
      where: { id: post.id },
      data: { pinned: body.pinned },
      select: { id: true, pinned: true },
    });
    return NextResponse.json({ post: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, postId } = await ctx.params;
  try {
    const channel = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    const post = await prisma.channelPost.findFirst({
      where: { id: postId, channelId: channel.id },
      select: { id: true, authorId: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (session.user.id !== channel.ownerId && session.user.id !== post.authorId) {
      return NextResponse.json({ error: "Not allowed to delete this post" }, { status: 403 });
    }

    await prisma.channelPost.delete({ where: { id: post.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
