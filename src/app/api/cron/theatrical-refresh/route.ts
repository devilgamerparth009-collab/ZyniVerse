import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTheatricalEntries, invalidateEditorial } from "@/lib/editorial";
import { syncTheatricalBoxOffice } from "@/lib/theatrical-boxoffice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fail-closed auth — same pattern as the other /api/cron routes.
 * The secret is never logged.
 */
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
 * Daily refresh for the curated theatrical editorial record.
 *
 * Worldwide grosses come from a single batched Wikipedia Action API request.
 * India figures stay in the editorial record (no free per-territory API), and
 * showtimes/seats stay on booking platforms — nothing is invented or cached.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const boxOffice = await syncTheatricalBoxOffice();
    invalidateEditorial("theatrical");
    const bundle = await getTheatricalEntries();
    const source = bundle.lastUpdated ? "editorial-db" : "static-fallback";

    revalidatePath("/theatrical-releases");

    return NextResponse.json({
      success: true,
      source,
      entries: bundle.entries.length,
      lastUpdated: bundle.lastUpdated,
      boxOffice: {
        checked: boxOffice.checked,
        matched: boxOffice.matched,
        updated: boxOffice.updated,
        error: boxOffice.error ?? null,
      },
      revalidated: ["/theatrical-releases"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Theatrical refresh failed", details: String(error) },
      { status: 500 }
    );
  }
}
