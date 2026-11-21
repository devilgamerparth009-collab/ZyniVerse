import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getLiveDubSchedule } from "@/lib/dub-live-schedule";

/**
 * Live Anime Dub Hindi schedule for the APK's Dub Hub.
 * Mirrors the source page's Ongoing / Upcoming sections with IST timestamps so
 * the app can render real countdowns and refresh itself every minute.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const schedule = await getLiveDubSchedule();
  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
  return withPublicCache(
    NextResponse.json({
      success: true,
      ...schedule,
      counts: { ongoing: schedule.ongoing.length, upcoming: schedule.upcoming.length },
    })
  );
}
