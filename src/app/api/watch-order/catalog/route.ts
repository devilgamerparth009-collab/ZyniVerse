import { getWatchOrderCatalog } from "@/lib/watch-order-catalog";

// Keep the external source fetch inside Next's data cache instead of making
// every browser talk to the raw GitHub file directly.
export const dynamic = "force-dynamic";

const CATALOG_CACHE = "public, s-maxage=21600, stale-while-revalidate=86400";

export async function GET() {
  try {
    const catalog = await getWatchOrderCatalog();
    return Response.json(catalog, {
      headers: { "Cache-Control": CATALOG_CACHE },
    });
  } catch (error) {
    console.error("Failed to load watch-order catalog:", error);
    return Response.json(
      { error: "Watch-order catalog is temporarily unavailable." },
      { headers: { "Cache-Control": "no-store" }, status: 502 },
    );
  }
}
