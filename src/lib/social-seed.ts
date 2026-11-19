import { prisma } from "@/lib/prisma";
import feed from "@/content/mobile-feed.json";

/**
 * Best-effort seed for the official announcement channel.
 *
 * Uses the seeded system account when no official user id is configured.
 * Never throws: discovery pages must keep working even if the seed fails.
 */
export async function ensureOfficialChannel(): Promise<void> {
  // The seeded system account is the stable fallback so a fresh deployment
  // gets one real official channel without requiring an env var. An explicit
  // env var still wins if the official account is ever changed.
  const ownerId = process.env.ZYVERSE_OFFICIAL_USER_ID || "system-bot";

  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (!owner) return;

    const channel = await prisma.broadcastChannel.upsert({
      where: { slug: "zyniverse" },
      update: {
        name: "ZyniVerse",
        description: "Official news, updates and announcements from ZyniVerse.",
        iconUrl: "https://zyverse.in/logo.png",
        isOfficial: true,
        ownerId: owner.id,
      },
      create: {
        slug: "zyniverse",
        name: "ZyniVerse",
        description: "Official news, updates and announcements from ZyniVerse.",
        iconUrl: "https://zyverse.in/logo.png",
        isOfficial: true,
        ownerId: owner.id,
      },
      select: { id: true },
    });

    const postCount = await prisma.channelPost.count({
      where: { channelId: channel.id },
    });
    if (postCount === 0) {
      await prisma.channelPost.create({
        data: {
          channelId: channel.id,
          authorId: owner.id,
          content: feed.announcement.message,
        },
      });
    }

    // One official welcome story so Stories is never a dead end on a fresh
    // database. It uses our own branded artwork, expires automatically, and
    // is created at most once (per 24h TTL) via the slug-stable channel id.
    const storyCount = await prisma.story.count({
      where: { channelId: channel.id },
    });
    if (storyCount === 0) {
      await prisma.story.create({
        data: {
          userId: owner.id,
          channelId: channel.id,
          mediaUrl: "https://zyverse.in/logo.png",
          mediaType: "image",
          caption: "Welcome to ZyniVerse stories.",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  } catch {
    // Seeding is optional: swallow database/configuration errors.
  }
}
