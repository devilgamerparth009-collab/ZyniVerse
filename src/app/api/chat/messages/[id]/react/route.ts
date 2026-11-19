import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse, after } from "next/server";
import { toggleReaction, broadcastToConversation } from "@/lib/chat";
import { aggregateReactions, stripControlChars } from "@/lib/social-types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/chat/messages/[id]/react'>
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { emoji?: unknown } | null;
  const emoji = typeof body?.emoji === "string" ? stripControlChars(body.emoji) : "";
  if (!emoji || emoji.length > 16) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  try {
    const msg = await prisma.message.findUnique({
      where: { id },
      select: { conversationId: true },
    });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const rows = await toggleReaction(id, session.user.id, emoji);
    const { reactions: reactionCounts, myReactions } = aggregateReactions(rows, session.user.id);
    after(() =>
      broadcastToConversation(msg.conversationId, session.user.id, "dm-reaction", {
        conversationId: msg.conversationId,
        messageId: id,
      }).catch(() => {})
    );
    // `reactions` stays a row array for the web client; the count map and the
    // viewer's emojis are added for native clients.
    return NextResponse.json({ reactions: rows, reactionCounts, myReactions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to react" },
      { status: 400 }
    );
  }
}
