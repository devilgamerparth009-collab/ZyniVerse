import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/resolve-user";
import { apiLimiter } from "@/lib/rate-limiter";
import { TOURNAMENT_SIZES, createTournament } from "@/lib/character-tournaments";
import { withPrivateCache, withPublicCache } from "@/lib/api-cache";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

  // Only the `mine=1` view is scoped to the visitor, so the session is only
  // read on that path.
  let where: Record<string, unknown> = {};
  if (mine) {
    const userId = await resolveUserId();
    where = userId ? { creatorId: userId } : { id: "none" };
  }

  const statusOrder: Record<string, number> = {
    active: 0,
    qualifying: 1,
    upcoming: 2,
    completed: 3,
    cancelled: 4,
  };

  const tournaments = await prisma.characterTournament.findMany({
    where,
    include: {
      creator: { select: { id: true, username: true, avatar: true } },
      _count: { select: { participants: true, matches: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  tournaments.sort(
    (a, b) =>
      (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );

  const res = NextResponse.json(tournaments);
  if (mine) return withPrivateCache(res);
  // Explicit list views (web and APK both send `limit`) must reflect a
  // tournament created seconds ago on either platform. Keep the anonymous
  // default cached for crawlers, but never cache the actual app/web lists.
  if (url.searchParams.has("limit")) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    return res;
  }
  return withPublicCache(res);
}

export async function POST(req: NextRequest) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" && body.description.trim() !== ""
      ? body.description.trim()
      : undefined;
  const posterUrl =
    typeof body.posterUrl === "string" && body.posterUrl.trim() !== ""
      ? body.posterUrl.trim()
      : undefined;
  const size = Number(body.size);
  const mode = body.mode === "qualifying" ? "qualifying" : "bracket";
  const bracketSize = Number(body.bracketSize) || (mode === "qualifying" ? 16 : size);

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  if (mode === "qualifying") {
    if (!Number.isInteger(size) || size < 16 || size > 200) {
      return NextResponse.json({ error: "Qualifying pool must be between 16 and 200 characters" }, { status: 400 });
    }
    if (!TOURNAMENT_SIZES.includes(bracketSize as (typeof TOURNAMENT_SIZES)[number])) {
      return NextResponse.json({ error: "Invalid bracket size" }, { status: 400 });
    }
  } else if (!TOURNAMENT_SIZES.includes(size as (typeof TOURNAMENT_SIZES)[number])) {
    return NextResponse.json({ error: "Invalid tournament size" }, { status: 400 });
  }

  const participants = Array.isArray(body.participants)
    ? body.participants
        .map((p: { charId?: unknown; charName?: unknown; charImage?: unknown; franchiseCover?: unknown }) => ({
          charId: Number(p?.charId),
          charName: typeof p?.charName === "string" ? p.charName.trim() : "",
          charImage:
            typeof p?.charImage === "string" && p.charImage.trim() !== "" ? p.charImage.trim() : undefined,
          franchiseCover:
            typeof p?.franchiseCover === "string" && p.franchiseCover.trim() !== "" ? p.franchiseCover.trim() : undefined,
        }))
        .filter((p: { charId: number; charName: string }) => p.charId && p.charName)
    : [];

  if (participants.length !== size) {
    return NextResponse.json(
      { error: `Tournament of size ${size} needs exactly ${size} characters` },
      { status: 400 }
    );
  }

  try {
    const tournament = await createTournament(userId, {
      title,
      description,
      posterUrl,
      size,
      mode,
      bracketSize,
      participants,
    });
    return NextResponse.json(tournament, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create tournament" },
      { status: 400 }
    );
  }
}
