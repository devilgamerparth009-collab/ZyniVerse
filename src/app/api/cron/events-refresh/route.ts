import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { invalidateAnimeEventsCache } from "@/lib/anime-events";
import { syncAnimeEventSources } from "@/lib/anime-event-sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fail-closed auth — the secret is compared but never logged. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const altHeader = req.headers.get("x-cron-secret");
  if (altHeader === secret) return true;

  const querySecret = new URL(req.url).searchParams.get("secret");
  return querySecret === secret;
}

/**
 * Daily /events source check.
 *
 * Official schemas and year-specific Wikipedia venue notes can change dates or
 * venue text. Attendance and unsourced announcements are removed instead of
 * guessed. Nothing here adds a client-side poll or an extra page API call.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sync = await syncAnimeEventSources();
    // Keep page/API caches aligned with the freshly checked source data.
    invalidateAnimeEventsCache();

    revalidatePath("/events");
    revalidatePath("/events/[slug]", "page");
    revalidatePath("/api/anime-events");

    return NextResponse.json({
      success: true,
      sync,
      revalidated: ["/events", "/events/[slug]", "/api/anime-events"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Events refresh failed", details: String(error) },
      { status: 500 }
    );
  }
}
