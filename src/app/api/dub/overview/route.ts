import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubOverview } from "@/lib/dub-import/queries";

export const dynamic = "force-dynamic";

async function handler() {
  try {
    return NextResponse.json({ success: true, ...(await getDubOverview()) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub overview", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return withPublicCache(await handler());
}
