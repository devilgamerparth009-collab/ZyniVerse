import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubCatalog } from "@/lib/dub-import/queries";
import { withoutProviderFields } from "@/lib/dub-import/public-fields";

export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const result = await getDubCatalog({
      source: searchParams.get("source"),
      kind: searchParams.get("kind"),
      language: searchParams.get("language"),
      genre: searchParams.get("genre"),
      q: searchParams.get("q"),
      sort: searchParams.get("sort"),
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || 24,
    });

    return NextResponse.json(
      withoutProviderFields({
        success: true,
        ...result,
        filters: {
          source: searchParams.get("source"),
          kind: searchParams.get("kind"),
          language: searchParams.get("language"),
          genre: searchParams.get("genre"),
          q: searchParams.get("q"),
          sort: searchParams.get("sort") ?? "recent",
        },
      })
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub catalogue", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return withPublicCache(await handler(request));
}
