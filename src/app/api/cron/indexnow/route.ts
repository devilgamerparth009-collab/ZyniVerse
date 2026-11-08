import { NextResponse } from "next/server";
import { submitToIndexNow } from "@/lib/indexnow";

export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export async function GET(request: Request) {
  // The cron workflow already sends `Authorization: Bearer $CRON_SECRET`. This
  // route was the only unauthenticated one, so anyone could make the site
  // submit 886 URLs to IndexNow — an open abuse/rate-limit vector.
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${BASE_URL}/sitemap.xml`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `sitemap fetch failed: ${res.status}` }, { status: 502 });
    }
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/g)].map((m) => m[1]);
    if (urls.length === 0) {
      return NextResponse.json({ error: "no urls found in sitemap" }, { status: 500 });
    }
    await submitToIndexNow(urls);
    return NextResponse.json({ ok: true, submitted: urls.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}