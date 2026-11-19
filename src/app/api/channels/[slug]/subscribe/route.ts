import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

type Context = RouteContext<'/api/channels/[slug]/subscribe'>;

async function findChannelId(slug: string): Promise<string | null> {
  const channel = await prisma.broadcastChannel.findUnique({
    where: { slug },
    select: { id: true },
  });
  return channel?.id ?? null;
}

export async function POST(req: NextRequest, ctx: Context) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  try {
    const channelId = await findChannelId(slug);
    if (!channelId) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    await prisma.channelSubscription.upsert({
      where: { channelId_userId: { channelId, userId: session.user.id } },
      update: {},
      create: { channelId, userId: session.user.id },
    });
    const subscriberCount = await prisma.channelSubscription.count({ where: { channelId } });
    return NextResponse.json({ subscribed: true, subscriberCount });
  } catch {
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  try {
    const channelId = await findChannelId(slug);
    if (!channelId) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    await prisma.channelSubscription.deleteMany({
      where: { channelId, userId: session.user.id },
    });
    const subscriberCount = await prisma.channelSubscription.count({ where: { channelId } });
    return NextResponse.json({ subscribed: false, subscriberCount });
  } catch {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
