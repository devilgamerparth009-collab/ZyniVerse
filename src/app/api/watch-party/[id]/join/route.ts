import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { joinParty, leaveParty } from "@/lib/watch-party";
import { broadcastRealtime } from "@/lib/realtime";

// Membership changes are persisted first; the live notification only tells
// already-open rooms to refresh their member list. Harmless when the socket.io
// transport is in use, because clients then never subscribe to this channel.
function notifyMembers(partyId: string, event: "member-joined" | "member-left", user: {
  id: string;
  username: string;
  avatar: string | null;
}) {
  after(() =>
    broadcastRealtime(`party:${partyId}`, event, { user, members: [] }).catch(() => {})
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const member = await joinParty(id, session.user.id);
    notifyMembers(id, "member-joined", {
      id: session.user.id,
      username: session.user.name || "User",
      avatar: session.user.image ?? null,
    });
    return NextResponse.json({ member });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await leaveParty(id, session.user.id);
    notifyMembers(id, "member-left", {
      id: session.user.id,
      username: session.user.name || "User",
      avatar: session.user.image ?? null,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
