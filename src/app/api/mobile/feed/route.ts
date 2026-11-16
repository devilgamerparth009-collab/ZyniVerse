import { NextResponse } from "next/server";
import feed from "@/content/mobile-feed.json";

/**
 * Server-driven content for the Android app.
 *
 * Anything edited in `src/content/mobile-feed.json` (announcement copy, emoji,
 * CTA, spotlight cards) shows up in every installed app on the next launch —
 * no APK update required. Keep the response tiny; it is fetched on focus.
 */
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
};

export async function GET() {
  return NextResponse.json(feed, { headers: NO_STORE });
}
