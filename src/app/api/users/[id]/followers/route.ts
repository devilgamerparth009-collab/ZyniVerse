import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/social-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<'/api/users/[id]/followers'>) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const cursor = searchParams.get("cursor");

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Accept either a follow row id (what we return) or a user id (what a
    // client naturally has from the last item in `users`).
    const cursorRow = cursor
      ? await prisma.follow.findFirst({
          where: { followingId: id, OR: [{ id: cursor }, { followerId: cursor }] },
          select: { id: true },
        })
      : null;

    const rows = await prisma.follow.findMany({
      where: { followingId: id },
      select: {
        id: true,
        createdAt: true,
        follower: { select: { id: true, username: true, avatar: true, bio: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursorRow ? { cursor: { id: cursorRow.id }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return NextResponse.json({
      users: page.map((row) => toPublicUser(row.follower)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load followers" }, { status: 500 });
  }
}
