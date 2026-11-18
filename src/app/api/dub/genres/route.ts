import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubGenreStats } from "@/lib/dub-import/queries";

export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  try {
    const genres = await getDubGenreStats(kind === "series" || kind === "movie" ? kind : undefined);
    return NextResponse.json({ success: true, total: genres.length, genres });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub genres", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return withPublicCache(await handler(request));
}
