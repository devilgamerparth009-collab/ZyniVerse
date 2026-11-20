import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLimiter } from "@/lib/rate-limiter";
import { ensureOfficialChannel } from "@/lib/social-seed";
import {
  channelSelect,
  isHttpUrl,
  stripControlChars,
  toChannelSummary,
  type ChannelSummary,
} from "@/lib/social-types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  const viewerId = session?.user?.id;

  try {
    await ensureOfficialChannel();
  } catch {
    // The seed is best effort; the list still works without it.
  }

  try {
    const rows = await prisma.broadcastChannel.findMany({
      select: channelSelect(viewerId),
    });
    const channels: ChannelSummary[] = rows
      .map((row) => toChannelSummary(row, viewerId))
      .sort(
        (a, b) =>
          Number(b.isOfficial) - Number(a.isOfficial) ||
          b.subscriberCount - a.subscriberCount ||
          a.name.localeCompare(b.name)
      );
    return NextResponse.json({ channels });
  } catch {
    return NextResponse.json({ error: "Failed to load channels" }, { status: 500 });
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "channel"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let attempt = 2; attempt < 1000; attempt++) {
    const existing = await prisma.broadcastChannel.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${attempt}`;
  }
  return `${base}-${Date.now()}`;
}

export async function POST(req: NextRequest) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: unknown;
    description?: unknown;
    iconUrl?: unknown;
    coverUrl?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? stripControlChars(body.name) : "";
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Name must be between 2 and 60 characters" },
      { status: 400 }
    );
  }

  const description =
    typeof body.description === "string"
      ? stripControlChars(body.description).slice(0, 1000) || null
      : null;
  const iconUrl = typeof body.iconUrl === "string" ? body.iconUrl.trim() : null;
  const coverUrl = typeof body.coverUrl === "string" ? body.coverUrl.trim() : null;
  if (iconUrl && !isHttpUrl(iconUrl)) {
    return NextResponse.json({ error: "Invalid icon URL" }, { status: 400 });
  }
  if (coverUrl && !isHttpUrl(coverUrl)) {
    return NextResponse.json({ error: "Invalid cover URL" }, { status: 400 });
  }

  try {
    const channel = await prisma.broadcastChannel.create({
      data: {
        name,
        slug: await uniqueSlug(slugify(name)),
        description,
        iconUrl,
        coverUrl,
        ownerId: session.user.id,
      },
      select: channelSelect(session.user.id),
    });
    return NextResponse.json({ channel: toChannelSummary(channel, session.user.id) });
  } catch {
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
  }
}
