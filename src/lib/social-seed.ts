import { prisma } from "@/lib/prisma";
import feed from "@/content/mobile-feed.json";

/**
 * Best-effort seed for the official announcement channel.
 *
 * No env var (or an unknown user id) is a no-op. Never throws: discovery pages
 * must keep working even if the seed cannot be written.
 */
export async function ensureOfficialChannel(): Promise<void> {
  const ownerId = process.env.ZYVERSE_OFFICIAL_USER_ID;
  if (!ownerId) return;

  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (!owner) return;

    const channel = await prisma.broadcastChannel.upsert({
      where: { slug: "zyniverse" },
      update: { name: "ZyniVerse", isOfficial: true, ownerId: owner.id },
      create: {
        slug: "zyniverse",
        name: "ZyniVerse",
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
  } catch {
    // Seeding is optional: swallow database/configuration errors.
  }
}
