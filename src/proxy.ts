import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { detectBot } from "@/lib/bot-detect";
import { BOT_COOKIE, BOT_COOKIE_MAX_AGE } from "@/lib/bot-cookie";

// ---------------------------------------------------------------------------
// Proxy runs on the Node.js runtime in Next.js 16 (middleware was renamed to
// Proxy and the Edge default was dropped in v16). `runtime` is not a valid
// option in Proxy files, so this can never become an Edge function.
//
// Proxy also runs *before* the CDN cache. Next.js' own CDN-caching guide is
// explicit about it: "proxy.js should run before the CDN cache so it remains
// the source of truth for auth, redirects, and rewrites." The practical
// consequence: every matched request costs one Proxy invocation, even when
// the page itself is served from the ISR cache and costs zero Function
// invocations.
//
// This file handles:
// - refusing crawlers at the analytics ingest endpoints
// - lightweight per-IP rate limiting for abusive/high-cost traffic on /api/*,
//   /search query variants, /filler/*, and parameterized/catalog routes while
//   allowing legitimate search/AI-discovery crawlers to remain indexable
// - crawler hit reporting
// - blocking bot renders of /forum/create
// - flagging crawler responses with a cookie so ad components can skip them
//
// Bot blocking already lives in the WAF (see VERCEL_WAF_RULES.md) where it is
// evaluated at the CDN edge and costs nothing against Function Duration.
// The in-memory limiter here is a best-effort safety net per instance.
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

function getBuckets(): Map<string, Bucket> {
  const g = globalThis as typeof globalThis & {
    __zyniProxyBuckets?: Map<string, Bucket>;
    __zyniProxyBucketsPrunedAt?: number;
  };
  if (!g.__zyniProxyBuckets) g.__zyniProxyBuckets = new Map<string, Bucket>();
  const now = Date.now();
  const last = g.__zyniProxyBucketsPrunedAt || 0;
  if (now - last > 60_000) {
    g.__zyniProxyBucketsPrunedAt = now;
    for (const [key, bucket] of g.__zyniProxyBuckets) {
      if (bucket.resetAt <= now) g.__zyniProxyBuckets.delete(key);
    }
  }
  return g.__zyniProxyBuckets;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function consume(ip: string, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const buckets = getBuckets();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function isHighCostApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/search") ||
    pathname.startsWith("/api/anilist/search") ||
    pathname.startsWith("/api/ai/search") ||
    pathname.startsWith("/api/filler") ||
    pathname.startsWith("/api/semantic") ||
    pathname.startsWith("/api/anilist/") ||
    pathname.startsWith("/api/dub")
  );
}

function isSearchQueryPath(pathname: string, hasQuery: boolean): boolean {
  return (pathname === "/search" || pathname.startsWith("/search/")) && hasQuery;
}

function isFillerPath(pathname: string): boolean {
  return pathname === "/filler" || pathname.startsWith("/filler/");
}

function isParameterizedCatalogPath(pathname: string): boolean {
  // Dynamic/content-heavy routes that are common scrape targets. This is
  // intentionally conservative and only used to throttle automated bursts.
  return (
    /^\/anime\/.+/.test(pathname) ||
    /^\/manga\/.+/.test(pathname) ||
    /^\/character\/.+/.test(pathname) ||
    /^\/staff\/.+/.test(pathname) ||
    /^\/alternatives\/.+/.test(pathname) ||
    /^\/watch-order\/.+/.test(pathname) ||
    /^\/wiki\/.+/.test(pathname) ||
    /^\/blog\/.+/.test(pathname) ||
    /^\/news\/.+/.test(pathname) ||
    /^\/studio\/.+/.test(pathname) ||
    /^\/voice-actors\/.+/.test(pathname) ||
    /^\/filler\/.+/.test(pathname)
  );
}

function rateLimitResponse(retryAfter: number, asJson: boolean) {
  const headers = {
    "Retry-After": String(retryAfter),
    "Cache-Control": "no-store, max-age=0",
  };
  if (asJson) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers }
    );
  }
  return new NextResponse("Too many requests. Please try again later.", {
    status: 429,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const userAgent = request.headers.get("user-agent") || "";
  const botInfo = userAgent ? detectBot(userAgent) : null;
  const isBot = botInfo !== null;
  const isDiscoveryBot = botInfo?.kind === "search" || botInfo?.kind === "ai-search";

  // -------------------------------------------------------------------------
  // Analytics ingest: refuse crawlers and empty/missing UAs here.
  // Answering from the Proxy means the route handler never runs.
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/api/analytics/")) {
    if (!userAgent.trim() || isBot) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // Lightweight rate limiting for abusive/high-cost traffic.
  //
  // - Legitimate discovery crawlers (search / AI-search) are allowed with a
  //   raised ceiling so SEO/AI discovery remains possible.
  // - Other automated traffic and high-rate abusive bursts are throttled.
  // - Normal page browsing by real users is not throttled on catalog routes.
  // -------------------------------------------------------------------------
  const ip = getClientIp(request);
  const hasQuery = request.nextUrl.search.length > 0;
  const isRead = method === "GET" || method === "HEAD";
  const isMutating = !isRead;
  const isApi = pathname.startsWith("/api/");

  let rate: { scope: string; max: number; windowMs: number } | null = null;

  if (isApi) {
    if (isHighCostApiPath(pathname)) {
      rate = isDiscoveryBot
        ? { scope: "api-high-discovery", max: 180, windowMs: 60_000 }
        : { scope: "api-high", max: isRead ? 45 : 25, windowMs: 60_000 };
    } else {
      // Keep general API limits generous enough for the mobile/web app while
      // still damping abusive floods.
      rate = isDiscoveryBot
        ? { scope: "api-discovery", max: 300, windowMs: 60_000 }
        : { scope: "api", max: isMutating ? 60 : 150, windowMs: 60_000 };
    }
  } else if (isSearchQueryPath(pathname, hasQuery)) {
    // Search result/filter combinations are an unbounded crawl and compute trap.
    rate = isDiscoveryBot
      ? { scope: "search-query-discovery", max: 120, windowMs: 60_000 }
      : { scope: "search-query", max: 40, windowMs: 60_000 };
  } else if (isFillerPath(pathname)) {
    rate = isDiscoveryBot
      ? { scope: "filler-discovery", max: 180, windowMs: 60_000 }
      : { scope: "filler", max: 90, windowMs: 60_000 };
  } else if (isParameterizedCatalogPath(pathname)) {
    // Throttle catalog detail pages to prevent scrapers from causing massive ISR writes.
    if (isDiscoveryBot) {
      rate = { scope: "catalog-discovery", max: 240, windowMs: 60_000 };
    } else if (isBot) {
      rate = { scope: "catalog-bot", max: 40, windowMs: 60_000 };
    } else {
      // Human or browser-mimicking headless scraper (Desktop/Windows UA).
      // Strict limit on catalog mirrors (/character/, /staff/, /manga/) where
      // rapid enumeration causes massive ISR writes and burns function limits.
      // Real humans browsing anime never open > 20 character/staff pages in 60s.
      const isMirrorRoute =
        pathname.startsWith("/character/") ||
        pathname.startsWith("/staff/") ||
        pathname.startsWith("/manga/");
      rate = isMirrorRoute
        ? { scope: "catalog-mirror", max: 20, windowMs: 60_000 }
        : { scope: "catalog-human", max: 60, windowMs: 60_000 };
    }
  }

  if (rate) {
    const result = consume(ip, rate.scope, rate.max, rate.windowMs);
    if (!result.allowed) {
      return rateLimitResponse(result.retryAfter, isApi);
    }
  }

  // -------------------------------------------------------------------------
  // Crawler / bot hit reporting (see /api/internal/bot-hit + src/lib/bot-stats).
  //
  // Only dispatched for known crawlers on GET/HEAD requests. The DB write
  // happens in a route handler inside `event.waitUntil` after the response is
  // sent to keep Prisma out of the Proxy bundle and off the critical path.
  // Reporting uses POST, so it cannot re-trigger this GET/HEAD branch.
  // -------------------------------------------------------------------------
  if (isRead && userAgent && isBot) {
    const report = new URL("/api/internal/bot-hit", request.url);
    event.waitUntil(
      fetch(report, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: pathname,
          userAgent,
          // The self-fetch is served from a datacenter IP, so the visitor's
          // country has to be copied from the original request headers.
          country: request.headers.get("x-vercel-ip-country"),
        }),
        cache: "no-store",
      }).then(
        () => undefined,
        () => undefined
      )
    );
  }

  // -------------------------------------------------------------------------
  // /forum/create — "create post" form. robots.txt already disallows /forum/,
  // so answering bots with 404 from the Proxy skips the render completely.
  // Only bots are affected; people can still use the page.
  // -------------------------------------------------------------------------
  if (pathname === "/forum/create" && isRead && isBot) {
    return new NextResponse(null, { status: 404 });
  }

  // -------------------------------------------------------------------------
  // Bot guard for ads.
  //
  // Only known crawler UAs get the cookie; real visitors never do, so their
  // responses remain cacheable and their ad rendering is untouched. A stale
  // cookie is cleared as soon as a request looks human again.
  // -------------------------------------------------------------------------
  const response = NextResponse.next();
  const hadBotCookie = Boolean(request.cookies.get(BOT_COOKIE));

  if (isBot) {
    if (!hadBotCookie) {
      response.cookies.set({
        name: BOT_COOKIE,
        value: "1",
        path: "/",
        maxAge: BOT_COOKIE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
      });
    }
  } else if (hadBotCookie) {
    response.cookies.delete(BOT_COOKIE);
  }

  return response;
}

export const config = {
  // Match high-cost and crawl-heavy surfaces so abusive traffic can be
  // throttled in code, while preserving existing crawler observation behavior.
  // `api/` is included for rate limiting (analytics ingest is answered early
  // with 204 for crawlers/empty UAs to avoid route work).
  matcher: [
    "/",
    "/sitemap.xml",
    "/robots.txt",
    "/api/:path*",
    "/anime/:path*",
    "/character/:path*",
    "/staff/:path*",
    "/manga/:path*",
    "/alternatives/:path*",
    "/filler",
    "/filler/:path*",
    "/search",
    "/search/:path*",
    "/news/:path*",
    "/blog/:path*",
    "/wiki/:path*",
    "/forum/:path*",
    "/schedule/:path*",
    "/seasonal/:path*",
    "/top-anime/:path*",
    "/indian-dubs/:path*",
    "/dubbed/:path*",
    "/hindi-dub-schedule/:path*",
    "/manga-releases/:path*",
    "/watch-order/:path*",
    "/live-action/:path*",
    "/toons/:path*",
    "/wallpapers/:path*",
    "/voice-actors/:path*",
    "/studio/:path*",
  ],
};
