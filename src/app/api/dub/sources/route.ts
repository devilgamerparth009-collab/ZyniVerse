import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubSources } from "@/lib/dub-import/queries";

export const dynamic = "force-dynamic";

async function handler() {
  try {
    const sources = await getDubSources();
    return NextResponse.json({ success: true, sources });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub sources", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return withPublicCache(await handler());
}
