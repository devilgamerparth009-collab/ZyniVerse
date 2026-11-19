import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse, after } from "next/server";
import { toggleReaction, broadcastToConversation } from "@/lib/chat";

export const dynamic = "force-dynamic";

const VALID_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "😡", "🔥"];

/** Legacy web-client endpoint; kept alongside `/react` for compatibility. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/chat/messages/[id]/reaction'>
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { emoji } = await req.json();
  if (!emoji || !VALID_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  try {
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const reactions = await toggleReaction(id, session.user.id, emoji);
    after(() =>
      broadcastToConversation(msg.conversationId, session.user.id, "dm-reaction", {
        conversationId: msg.conversationId,
        messageId: id,
        reactions,
      }).catch(() => {})
    );
    return NextResponse.json({ reactions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to react" },
      { status: 400 }
    );
  }
}
