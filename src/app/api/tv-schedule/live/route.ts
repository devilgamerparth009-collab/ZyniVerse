import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { buildTvSchedule } from "@/lib/tv-schedule-data";

/**
 * Full live grid (linear TV from epg.pw + streaming from AniList).
 *
 * This used to scrape 12 channels x 3 days in sequential batches and routinely
 * blew past Vercel's function cap (504). The scraper now fetches all channels
 * in parallel for today + tomorrow and stores the result in `epgCache`, so this
 * route is fast after the first call of the day.
 */
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  epg: "epg.pw",
  live: "AniList",
  fallback: "Offline guide",
  empty: "No source",
};

async function GET_inner() {
  try {
    const grid = await buildTvSchedule();
    return NextResponse.json({
      updatedAt: grid.updatedAt,
      today: grid.today,
      channels: grid.channels.map((entry) => ({
        ...entry,
        sourceLabel: SOURCE_LABELS[entry.source ?? "empty"],
      })),
      liveAiringTotal: grid.liveAiringTotal,
      offlineLinear: grid.offlineLinear ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        today: new Date().toLocaleDateString("en-US", { weekday: "long" }),
        channels: [],
        liveAiringTotal: 0,
        error: error instanceof Error ? error.message : "Failed to fetch",
      },
      { status: 200 }
    );
  }
}

export async function GET(...args: Parameters<typeof GET_inner>) {
  const res = await GET_inner(...args);
  return withPublicCache(res);
}
