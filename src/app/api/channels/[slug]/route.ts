import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureOfficialChannel } from "@/lib/social-seed";
import { channelSelect, toChannelSummary } from "@/lib/social-types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<'/api/channels/[slug]'>) {
  const { slug } = await ctx.params;
  const session = await auth();
  const viewerId = session?.user?.id;

  try {
    await ensureOfficialChannel();
  } catch {
    // Best effort only.
  }

  try {
    const channel = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: channelSelect(viewerId),
    });
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    return NextResponse.json({ channel: toChannelSummary(channel, viewerId) });
  } catch {
    return NextResponse.json({ error: "Failed to load channel" }, { status: 500 });
  }
}
