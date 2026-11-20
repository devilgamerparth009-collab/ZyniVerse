import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getPublicProfileData } from "@/lib/public-profile";
import { getFriendStatus } from "@/lib/friend-requests";
import { safeDecode } from "@/lib/url-params";

/**
 * Public profile payload for the Android app.
 *
 * The website renders `/u/[username]` on the server; the APK cannot, so this
 * route exposes the exact same data plus the viewer's relationship to the
 * profile (self / following / friend status) so the native screen can show the
 * right action button without a second round-trip.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const username = safeDecode(raw);

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data = await getPublicProfileData(target.id);
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const session = await auth();
  const viewerId = session?.user?.id || null;

  let isFollowing = false;
  let friendStatus: unknown = null;

  if (viewerId) {
    const [follow, status] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: target.id },
        },
        select: { id: true },
      }),
      getFriendStatus(viewerId, target.id).catch(() => null),
    ]);
    isFollowing = !!follow;
    friendStatus = status;
  }

  return NextResponse.json(
    {
      ...data,
      isSelf: viewerId === target.id,
      isFollowing,
      friendStatus,
      viewerId,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
