import { NextResponse } from "next/server";
import { getVibeSnapshot } from "@/lib/vibe";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getVibeSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    logError(e);
    return NextResponse.json({ error: "Could not read the community pulse" }, { status: 500 });
  }
}
