import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TV_CHANNEL_LOGO_SOURCES, TV_CHANNELS } from "@/lib/tv-channels";

/**
 * Same-origin channel logo proxy (legacy + fallback).
 *
 * Primary logos now ship as static files in `public/channel-logos/<id>.png`
 * and `logoProxyUrl` points straight at them. This handler stays around so
 * already-installed app versions keep working, and so a missing static file
 * degrades to a branded SVG wordmark instead of a blank 1x1 pixel.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000, immutable",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * A clean branded wordmark. Never blank, so the client always has something
 * legible to show even if every upstream source is down.
 */
function wordmark(id: string): Response {
  const channel = TV_CHANNELS[id];
  const label = escapeXml(channel?.shortName || channel?.name || id.toUpperCase());
  const name = escapeXml(channel?.name || id);
  const accent = escapeXml(channel?.color || "#38bdf8");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#11121c"/>
      <stop offset="1" stop-color="#1b1d2e"/>
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="34" fill="url(#g)"/>
  <rect x="18" y="18" width="284" height="164" rx="24" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="3"/>
  <text x="160" y="96" fill="${accent}" font-family="Arial Black, Arial, sans-serif" font-size="54" font-weight="900" text-anchor="middle" letter-spacing="2">${label}</text>
  <text x="160" y="138" fill="#e6e8f5" font-family="Arial, sans-serif" font-size="20" font-weight="700" text-anchor="middle">${name}</text>
  <rect x="118" y="154" width="84" height="5" rx="2.5" fill="${accent}"/>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", ...CACHE_HEADERS },
  });
}

async function localLogo(id: string): Promise<Response | null> {
  try {
    const file = path.join(process.cwd(), "public", "channel-logos", `${id}.png`);
    const body = await readFile(file);
    if (!body.byteLength) return null;
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "image/png", ...CACHE_HEADERS },
    });
  } catch {
    return null;
  }
}

async function fetchLogo(src: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(src, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
          Referer: "https://zyverse.in/",
        },
        next: { revalidate: 604800 },
      });
      if (upstream.ok) {
        const type = upstream.headers.get("content-type") || "";
        if (!type.startsWith("image/")) continue;
        const body = await upstream.arrayBuffer();
        // Reject Wikimedia's 1x1 error pixel as well as empty bodies.
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

  const local = await localLogo(id);
  if (local) return local;

  const src = TV_CHANNEL_LOGO_SOURCES[id];
  if (src) {
    const remote = await fetchLogo(src);
    if (remote) return remote;
  }

  // Never return the old transparent 1x1: clients treat a 200 as success and
  // then render an empty square. A branded wordmark is always legible.
  if (TV_CHANNELS[id]) return wordmark(id);

  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
