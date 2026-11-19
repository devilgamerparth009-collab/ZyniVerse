import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse, after } from "next/server";
import { deleteMessage, broadcastToConversation } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<'/api/chat/messages/[id]'>
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { mode?: unknown } | null;
  if (body?.mode !== undefined && body.mode !== "me" && body.mode !== "everyone") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  // No mode means "delete for everyone" (the v1.5.0 contract). The web client
  // still sends an explicit mode, so both flows keep working.
  const mode: "me" | "everyone" = body?.mode === "me" ? "me" : "everyone";
  const userId = session.user.id;

  try {
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    let deletedFor: string[] = [];
    let isDeleted = false;
    if (mode === "everyone") {
      if (msg.senderId !== userId) {
        return NextResponse.json({ error: "Only the sender can delete this message" }, { status: 403 });
      }
      await prisma.message.update({
        where: { id },
        data: { isDeleted: true, content: "" },
      });
      isDeleted = true;
    } else {
      const updated = await deleteMessage(id, userId, "me");
      deletedFor = updated?.deletedFor ? updated.deletedFor.split(",").filter(Boolean) : [];
    }

    after(() =>
      broadcastToConversation(msg.conversationId, userId, "dm-delete", {
        conversationId: msg.conversationId,
        messageId: id,
        mode,
        deletedFor,
        isDeleted,
      }).catch(() => {})
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete" },
      { status: 400 }
    );
  }
}
