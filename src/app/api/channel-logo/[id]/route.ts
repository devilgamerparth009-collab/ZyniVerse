import { NextRequest } from "next/server";
import { TV_CHANNEL_LOGO_SOURCES } from "@/lib/tv-channels";

/**
 * Same-origin channel logo proxy.
 *
 * Why this exists: every channel logo used to be loaded straight from
 * `upload.wikimedia.org`. Wikimedia answers bursty app traffic with
 * `429 Too Many Requests`, so on Android most logos silently failed and the
 * TV guide showed empty squares. The phone now asks zyverse.in for
 * `/api/channel-logo/<channelId>`; this handler fetches the upstream file once,
 * keeps it in the Next.js data cache for a week, and returns it with immutable
 * CDN headers. Every later viewer is served from the edge.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// 1x1 transparent PNG. Used when the upstream is unreachable so the client
// falls back to its own branded channel badge instead of showing a broken icon.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000, immutable",
};

async function fetchLogo(src: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(src, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
          Referer: "https://zyverse.in/",
        },
        // Cache the upstream bytes for a week; logos never change.
        next: { revalidate: 604800 },
      });
      if (upstream.ok) {
        const type = upstream.headers.get("content-type") || "";
        // Some CDNs answer 200 with an HTML error page — never pass that on.
        if (!type.startsWith("image/")) continue;
        const body = await upstream.arrayBuffer();
        if (body.byteLength === 0) continue;
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": type, ...CACHE_HEADERS },
        });
      }
    } catch {
      // fall through to the retry
    }
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const src = TV_CHANNEL_LOGO_SOURCES[id];
  if (!src) {
    return new Response(TRANSPARENT_PNG, {
      status: 404,
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" },
    });
  }

  const logo = await fetchLogo(src);
  if (logo) return logo;

  // Short cache so a transient outage does not stick for a week.
  return new Response(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
