import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getNotifications, markAllAsRead, getUnreadCount } from "@/lib/notifications";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const [notifications, unreadCount, total] = await Promise.all([
    getNotifications(session.user.id, limit, offset),
    getUnreadCount(session.user.id),
    prisma.notification.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ notifications, unreadCount, total });
}

export async function PUT() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markAllAsRead(session.user.id);
  return NextResponse.json({ success: true });
}
