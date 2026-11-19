import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: RouteContext<'/api/stories/[id]/view'>) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const story = await prisma.story.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId: id, viewerId: session.user.id } },
      update: {},
      create: { storyId: id, viewerId: session.user.id },
    });
    const viewCount = await prisma.storyView.count({ where: { storyId: id } });
    return NextResponse.json({ success: true, viewCount });
  } catch {
    return NextResponse.json({ error: "Failed to view story" }, { status: 500 });
  }
}
