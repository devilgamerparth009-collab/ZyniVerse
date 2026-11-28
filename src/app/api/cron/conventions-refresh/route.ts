import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncConventionSources } from "@/lib/convention-auto-sync";

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
 * Daily unattended convention fact check.
 *
 * Only official organiser/ticket sources can write fields. News feeds and
 * discovery sites are never consulted. Dates, URLs and the combined date range
 * are validated before an update, and hidden rows are excluded at both the
 * select and write steps.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sync = await syncConventionSources();

    revalidatePath("/conventions");
    revalidatePath("/conventions/[id]", "page");
    revalidatePath("/api/conventions");

    return NextResponse.json({
      success: true,
      sync,
      revalidated: ["/conventions", "/conventions/[id]", "/api/conventions"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Conventions refresh failed", details: String(error) },
      { status: 500 }
    );
  }
}
