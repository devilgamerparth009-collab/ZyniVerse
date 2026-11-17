import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubLanguages } from "@/lib/dub-import/queries";

export const dynamic = "force-dynamic";

async function handler() {
  try {
    const languages = await getDubLanguages();
    return NextResponse.json({ success: true, total: languages.length, languages });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub languages", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return withPublicCache(await handler());
}
