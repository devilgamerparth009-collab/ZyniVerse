import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { detectBot } from "@/lib/bot-detect";
import { BOT_COOKIE, BOT_COOKIE_MAX_AGE } from "@/lib/bot-cookie";
import { getClientIp as getTrustedClientIp } from "@/lib/request-ip";
import { HUMAN_COOKIE, verifyHumanToken } from "@/lib/human-verification";

const APP_CLIENT_HEADER = "x-zyniverse-client";
const APP_CLIENT_VALUE = "zyniverse-mobile-v1";
const APP_SECRET_HEADER = "x-zyniverse-app-secret";
const APP_SECRET_VALUE = process.env.MOBILE_APP_SECRET || "";
const ALLOWED_API_HOSTS = new Set([
  "zyverse.in",
  "www.zyverse.in",
  "localhost",
  "127.0.0.1",
]);

function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_HEADERS =
  "authorization, content-type, x-zyniverse-client, x-zyniverse-app-secret, x-api-key, x-internal-secret";

const NOINDEX_MIRROR_BLOCK_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function allowedCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = hostFromUrl(origin);
  if (host && ALLOWED_API_HOSTS.has(host) && origin.startsWith("https://")) return origin;
  if (host && (host === "localhost" || host === "127.0.0.1")) return origin;

  const configured = (process.env.ALLOWED_CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : null;
}

function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const origin = allowedCorsOrigin(request);
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.append("Vary", "Origin");
  return response;
}

const SCRIPT_UA_RE =
  /(python-requests|python-urllib|aiohttp|httpx\/|scrapy|go-http-client|curl\/|wget\/|libwww-perl|node-fetch|axios\/|postmanruntime|insomnia)/i;

function hasAllowedApiClient(request: NextRequest): boolean {
  if (APP_SECRET_VALUE && request.headers.get(APP_SECRET_HEADER) === APP_SECRET_VALUE) return true;
  if (request.headers.get(APP_CLIENT_HEADER) === APP_CLIENT_VALUE) return true;
  const originHost = hostFromUrl(request.headers.get("origin"));
  if (originHost && ALLOWED_API_HOSTS.has(originHost)) return true;
  const refererHost = hostFromUrl(request.headers.get("referer"));
  if (refererHost && ALLOWED_API_HOSTS.has(refererHost)) return true;
  const secFetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return true;
  }
  // Backward compatibility for existing/older mobile APKs that don't send the
  // client header yet. Native app requests typically omit browser Origin/Referer/
  // Sec-Fetch-* headers. Allow them only when they do not look like obvious
  // scripting clients. Set ALLOW_LEGACY_NO_ORIGIN_API=0 after APK rollout to block.
  const allowLegacyNoOrigin = process.env.ALLOW_LEGACY_NO_ORIGIN_API !== "0";
  const hasOrigin = !!request.headers.get("origin");
  const hasReferer = !!request.headers.get("referer");
  const hasSecFetch = !!request.headers.get("sec-fetch-site");
  if (!hasOrigin && !hasReferer && !hasSecFetch) {
    if (!allowLegacyNoOrigin) return false;
    const ua = request.headers.get("user-agent") || "";
    if (ua && SCRIPT_UA_RE.test(ua)) return false;
    return true;
  }
  return false;
}

function isPublicApiException(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/og/")
  );
}

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
  return getTrustedClientIp(request);
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

// Public dynamic routes that can create an ISR entry per crawled ID. These are
// rate-limited instead of human-verification-redirected so people and search
// crawlers keep working while scraper bursts stay bounded.
const PARAMETERIZED_CATALOG_PREFIXES = [
  "/anime/",
  "/manga/",
  "/character/",
  "/staff/",
  "/alternatives/",
  "/watch-order/",
  "/wiki/",
  "/blog/",
  "/news/",
  "/news/desk/",
  "/studio/",
  "/voice-actors/",
  "/themes/",
  "/ost/",
  "/filler/",
  "/awards/",
  "/compare/",
  "/list-share/",
  "/conventions/",
  "/list/",
  "/dna/",
  "/doujinshi/",
  "/clubs/",
  "/creators/",
  "/cosplay/",
  "/fanart/",
  "/events/",
  "/forum/",
  "/guides/",
  "/genre/",
  "/moments/",
  "/commissions/",
  "/polls/",
  "/reels/",
  "/voice-lines/",
  "/reviews/",
  "/tierlist/",
  "/posts/",
  "/light-novels/",
  "/indian-dubs/",
  "/hindi-dub/",
  "/manga-releases/",
  "/live-action/",
  "/toons/",
];

function isParameterizedCatalogPath(pathname: string): boolean {
  return PARAMETERIZED_CATALOG_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Low-value / noindex surfaces disallowed in robots.ts. Training, SEO and
// unknown bots are answered before any render; discovery bots stay allowed.
const NOINDEX_PATH_PREFIXES = [
  "/character/",
  "/manga/",
  "/staff/",
  "/list-share/",
  "/creators/",
  "/posts/",
  "/reels/",
  "/moments/",
  "/polls/",
  "/forum/",
  "/search",
  "/doujinshi",
  "/mature",
];

function isNoindexMirrorPath(pathname: string): boolean {
  return NOINDEX_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function rateLimitResponse(retryAfter: number, asJson: boolean) {
  const headers = {
    "Retry-After": String(retryAfter),
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
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

function isHumanVerificationExempt(pathname: string): boolean {
  if (
    pathname === "/verify-human" ||
    pathname === "/login" ||
    pathname === "/auth/mobile-done" ||
    pathname === "/api/verify-human" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/ads.txt" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname === "/opensearch.xml"
  ) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/internal/")) return true;
  if (pathname.startsWith("/api/og/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf)$/i.test(pathname)) return true;
  return false;
}

function isProtectedPageRequest(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("next-router-prefetch")) return false;
  if ((request.headers.get("purpose") || "").toLowerCase() === "prefetch") return false;
  const dest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
  const accept = request.headers.get("accept") || "";
  const isRsc = request.headers.get("rsc") === "1" || accept.includes("text/x-component");
  if (dest === "document") return true;
  if (isRsc) return true;
  if (!dest && accept.includes("text/html")) return true;
  return false;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const userAgent = request.headers.get("user-agent") || "";
  const botInfo = userAgent ? detectBot(userAgent) : null;
  const isBot = botInfo !== null;
  const isDiscoveryBot = botInfo?.kind === "search" || botInfo?.kind === "ai-search";
  const isApi = pathname.startsWith("/api/");
  const isRead = method === "GET" || method === "HEAD";

  // Hard-404 abusive crawlers on noindex/private surfaces before any render,
  // rate-limit bookkeeping or bot-hit reporting. Search/AI-search crawlers,
  // AdSense (monitor) and social unfurlers remain allowed; training/SEO/unknown
  // bots are the ones enumerating these high-cardinality routes.
  if (isRead && isNoindexMirrorPath(pathname)) {
    const blockedBot =
      !userAgent.trim() ||
      (botInfo !== null &&
        (botInfo.kind === "ai-training" || botInfo.kind === "seo" || botInfo.kind === "other"));
    if (blockedBot) {
      return new NextResponse(null, { status: 404, headers: NOINDEX_MIRROR_BLOCK_HEADERS });
    }
  }

  // Human verification gate: first visit requires verification, then cookie allows browsing.
  // Discovery crawlers are exempt to avoid breaking SEO/AdSense indexing.
  // Public catalog/content pages are handled by the client-side gate in the app layout
  // to avoid proxy redirects hurting UX/caching on crawl-heavy routes we rate-limit here.
  const hasQuery = request.nextUrl.search.length > 0;
  const isPublicCatalogPage =
    !isApi && (isParameterizedCatalogPath(pathname) || isFillerPath(pathname) || isSearchQueryPath(pathname, hasQuery));
  if (
    !isApi &&
    !isDiscoveryBot &&
    !isPublicCatalogPage &&
    !isHumanVerificationExempt(pathname) &&
    isProtectedPageRequest(request)
  ) {
    const humanOk = await verifyHumanToken(request.cookies.get(HUMAN_COOKIE)?.value);
    if (!humanOk) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = "/verify-human";
      const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      verifyUrl.search = `?next=${encodeURIComponent(nextPath.startsWith("/") ? nextPath : "/")}`;
      return NextResponse.redirect(verifyUrl, 307);
    }
  }

  // -------------------------------------------------------------------------
  // Analytics ingest: refuse crawlers and empty/missing UAs here.
  // Answering from the Proxy means the route handler never runs.
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/api/analytics/")) {
    if (!userAgent.trim() || isBot) {
      return withCors(
        new NextResponse(null, { status: 204, headers: { "X-Robots-Tag": "noindex, nofollow" } }),
        request
      );
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return withCors(res, request);
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
  const isMutating = !isRead;

  if (isApi && method === "OPTIONS") {
    const preflight = new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
    return withCors(preflight, request);
  }

  // Block third-party/unknown API clients. Official web (same-origin) and
  // official mobile app (client header) are allowed; cron/auth/internal/og
  // have their own controls or public needs.
  if (isApi && !isPublicApiException(pathname) && !hasAllowedApiClient(request)) {
    return withCors(
      NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } }
      ),
      request
    );
  }

  // Require human verification cookie for browser-originated API requests.
  // Exempts verify/auth/cron/internal/og/webhooks/analytics and official mobile header.
  if (
    isApi &&
    pathname !== "/api/verify-human" &&
    !isPublicApiException(pathname) &&
    !pathname.startsWith("/api/analytics/") &&
    request.headers.get(APP_CLIENT_HEADER) !== APP_CLIENT_VALUE &&
    !(APP_SECRET_VALUE && request.headers.get(APP_SECRET_HEADER) === APP_SECRET_VALUE)
  ) {
    const hasBrowserSignals = !!(request.headers.get("origin") || request.headers.get("referer") || request.headers.get("sec-fetch-site") || request.headers.get("sec-fetch-mode"));
    if (hasBrowserSignals) {
      const humanOk = await verifyHumanToken(request.cookies.get(HUMAN_COOKIE)?.value);
      if (!humanOk) {
        return withCors(
          NextResponse.json(
            { error: "Human verification required" },
            { status: 403, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } }
          ),
          request
        );
      }
    }
  }

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
    // Mirror routes are high-cardinality AniList/catalog pages: first hit per unique ID
    // can trigger an ISR write/render, so enumeration is especially expensive.
    const isMirrorRoute =
      pathname.startsWith("/character/") ||
      pathname.startsWith("/staff/") ||
      pathname.startsWith("/manga/") ||
      pathname.startsWith("/voice-actors/") ||
      pathname.startsWith("/studio/") ||
      pathname.startsWith("/themes/") ||
      pathname.startsWith("/ost/") ||
      pathname.startsWith("/watch-order/");
    if (isDiscoveryBot) {
      // Allow legitimate search/AI discovery crawlers, but keep them bounded.
      rate = isMirrorRoute
        ? { scope: "catalog-discovery-mirror", max: 120, windowMs: 60_000 }
        : { scope: "catalog-discovery", max: 240, windowMs: 60_000 };
    } else if (isBot) {
      rate = isMirrorRoute
        ? { scope: "catalog-bot-mirror", max: 12, windowMs: 60_000 }
        : { scope: "catalog-bot", max: 40, windowMs: 60_000 };
    } else {
      // Human or browser-mimicking headless scraper (Desktop/Windows UA).
      // Real users rarely open many mirror detail pages in a minute; scrapers do.
      rate = isMirrorRoute
        ? { scope: "catalog-mirror", max: 12, windowMs: 60_000 }
        : { scope: "catalog-human", max: 60, windowMs: 60_000 };
    }
  }

  if (rate) {
    const result = consume(ip, rate.scope, rate.max, rate.windowMs);
    if (!result.allowed) {
      return withCors(rateLimitResponse(result.retryAfter, isApi), request);
    }
  }

  // Report crawler hits by default; set DISABLE_BOT_HIT_REPORTING=1 to opt out
  // on deployments where the extra internal function invocation is unwanted.
  // Sample bot-hit reporting to reduce internal function invocations during bot floods.
  // Set BOT_HIT_REPORT_SAMPLE_RATE=1 to report every hit, or 0 to disable sampling logic.
  const botHitSampleRateRaw = Number(process.env.BOT_HIT_REPORT_SAMPLE_RATE ?? "0.1");
  const botHitSampleRate = Number.isFinite(botHitSampleRateRaw)
    ? Math.min(1, Math.max(0, botHitSampleRateRaw))
    : 0.1;
  if (process.env.DISABLE_BOT_HIT_REPORTING !== "1" && isRead && userAgent && isBot && Math.random() < botHitSampleRate) {
    const report = new URL("/api/internal/bot-hit", request.url);
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
    event.waitUntil(
      fetch(report, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
        },
        body: JSON.stringify({
          path: pathname,
          userAgent,
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

  if (isApi) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return withCors(response, request);
}

export const config = {
  // Keep matcher narrow to control function invocations.
  // Human verification is enforced for browser-originated API requests here,
  // and by a client-side gate in the app layout for page UX.
  // Crawl-heavy catalog routes are included so proxy rate limiting can damp bot
  // enumeration before expensive ISR/function renders. Keep this list targeted.
  matcher: [
    "/api/:path*",
    "/verify-human",
    "/anime/:path*",
    "/manga/:path*",
    "/character/:path*",
    "/staff/:path*",
    "/voice-actors/:path*",
    "/studio/:path*",
    "/themes/:path*",
    "/ost/:path*",
    "/watch-order/:path*",
    "/filler/:path*",
    "/search",
    "/search/:path*",
    "/alternatives/:path*",
    "/wiki/:path*",
    "/blog/:path*",
    "/news/:path*",
    "/awards/:path*",
    "/compare/:path*",
    "/list-share/:path*",
    "/conventions/:path*",
    "/list/:path*",
    "/dna/:path*",
    "/doujinshi/:path*",
    "/mature/:path*",
    "/clubs/:path*",
    "/creators/:path*",
    "/cosplay/:path*",
    "/fanart/:path*",
    "/events/:path*",
    "/forum/:path*",
    "/guides/:path*",
    "/genre/:path*",
    "/moments/:path*",
    "/commissions/:path*",
    "/polls/:path*",
    "/reels/:path*",
    "/voice-lines/:path*",
    "/reviews/:path*",
    "/tierlist/:path*",
    "/posts/:path*",
    "/light-novels/:path*",
    "/indian-dubs/:path*",
    "/hindi-dub/:path*",
    "/manga-releases/:path*",
    "/live-action/:path*",
    "/toons/:path*",
  ],
};
