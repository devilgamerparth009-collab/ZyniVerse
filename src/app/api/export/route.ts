import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const userId = session.user.id;

  const [profile, entries, progress, reviews, longReviews, mangaEntries, lists, tierLists,
    moments, reels, cosplays, fanArts, memes, blogPosts, forumThreads,
    userPoints, dailyLogin, streakFreeze, quizScores, animeFollows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, avatar: true, bio: true, banner: true,
        referralCode: true, referredBy: true, referralCount: true, themeColor: true,
        signature: true, provider: true, onboarded: true, favoriteGenres: true,
        favoriteMoods: true, lastSeen: true, createdAt: true,
      },
    }),
    prisma.listEntry.findMany({ where: { userId }, take: 5000 }),
    prisma.episodeProgress.findMany({ where: { userId }, take: 5000 }),
    prisma.review.findMany({ where: { userId }, take: 5000 }),
    prisma.longReview.findMany({ where: { userId }, take: 5000 }),
    prisma.mangaEntry.findMany({ where: { userId }, take: 5000 }),
    prisma.userList.findMany({ where: { userId }, take: 5000 }),
    prisma.tierList.findMany({ where: { userId }, take: 5000 }),
    prisma.moment.findMany({ where: { userId }, take: 5000 }),
    prisma.reel.findMany({ where: { userId }, take: 5000 }),
    prisma.cosplay.findMany({ where: { userId }, take: 5000 }),
    prisma.fanArt.findMany({ where: { userId }, take: 5000 }),
    prisma.meme.findMany({ where: { userId }, take: 5000 }),
    prisma.blogPost.findMany({ where: { userId }, take: 5000 }),
    prisma.forumThread.findMany({ where: { userId }, take: 5000 }),
    prisma.userPoints.findUnique({ where: { userId } }),
    prisma.dailyLogin.findUnique({ where: { userId } }),
    prisma.streakFreeze.findUnique({ where: { userId } }),
    prisma.quizScore.findMany({ where: { userId }, take: 5000 }),
    prisma.animeFollow.findMany({ where: { userId }, take: 5000 }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    zyniverse: profile,
    watchlistEntries: entries,
    episodeProgress: progress,
    reviews,
    longReviews,
    mangaEntries: mangaEntries,
    lists,
    tierLists,
    moments,
    reels,
    cosplays,
    fanArts,
    memes,
    blogPosts,
    forumThreads,
    points: userPoints,
    dailyLogin,
    streakFreeze,
    quizScores,
    animeFollows,
  };

  const filename = `zyniverse-data-${userId.slice(0, 8)}-${Date.now()}.json`;
  const body = JSON.stringify(data, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
