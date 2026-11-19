import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse, after } from "next/server";
import { broadcastToConversation } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `typing` is the legacy web-client field; `isTyping` is the v1.5.0 name.
  const body = await req.json().catch(() => null) as {
    conversationId?: unknown;
    isTyping?: unknown;
    typing?: unknown;
  } | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  const isTyping = body?.isTyping === undefined ? Boolean(body?.typing) : Boolean(body.isTyping);

  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    select: { user: { select: { id: true, username: true } } },
  });
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  after(() =>
    broadcastToConversation(conversationId, session.user.id, "dm-typing", {
      conversationId,
      userId: session.user.id,
      username: participant.user.username,
      isTyping,
      typing: isTyping,
    }).catch(() => {})
  );

  return NextResponse.json({ success: true });
}
