import type { NextConfig } from "next";
import { EventEmitter } from "events";

// Home page fires many parallel compressed responses; Next's server Gzip
// streams hit Node's default 10-listener cap and emit a benign
// MaxListenersExceededWarning. Raise it here so it covers the `next dev`
// process too (production already does this in server.ts).
EventEmitter.defaultMaxListeners = 50;

// Keep this CSP compatible with Next.js' inline bootstrap scripts and the
// third-party scripts the site already uses (GA4, AdSense, Turnstile).
// `unsafe-inline` is limited to scripts/styles; object/base/frame sources
// are locked down, which stops the common XSS/clickjacking payloads.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // bauval.org hosts every active Adsterra placement in src/lib/ads.ts.
  // Without it the dynamically injected ad scripts are blocked by CSP and the
  // slots stay empty even though the network/ad code is configured correctly.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://apis.google.com https://challenges.cloudflare.com https://bauval.org",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "frame-src https:",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

// High-cardinality catalog detail pages are rendered dynamically (no ISR
// writes, no per-id data-cache entries). Give the CDN a long public TTL so the
// next crawl hit is served at the edge instead of starting a Node render.
const CATALOG_CDN_CACHE = "public, s-maxage=604800, stale-while-revalidate=2592000";
const CATALOG_CACHE_HEADERS = [{ key: "Cache-Control", value: CATALOG_CDN_CACHE }];
const NOINDEX_MIRROR_HEADERS = [
  { key: "Cache-Control", value: CATALOG_CDN_CACHE },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "sharp"],
  // The /api/img route reads from public/uploads at runtime; without excludes
  // file tracing can pull large static assets (e.g. release APKs in public/)
  // into the serverless function bundle, exceeding Vercel's size limit.
  outputFileTracingExcludes: {
    "/api/img": ["./public/**/*.apk"],
  },
  // output: "export",  // REMOVED to fix ISR writes overage
  // This was causing ISR writes exceeding free tier limits (1.2M vs 200K)
  // Normal serverless function mode will reduce Vercel usage

  async headers() {
    return [
      // No Cache-Control rule for /_next/static here on purpose. Next only
      // applies its own asset cache header when one isn't already set:
      //   production -> `public, max-age=31536000, immutable`
      //   dev        -> `no-cache, must-revalidate`
      // A custom rule short-circuits that check, so dev builds got pinned to a
      // 1-year cache and served stale chunks on reload.
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self)" },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
      {
        source: "/api/anilist/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/api/filler/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/api/og/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" },
        ],
      },
      // Public, high-cardinality catalog pages render dynamically on the
      // server (no ISR/data-cache writes) and are cached at the CDN instead.
      // This keeps crawler traffic from becoming Node renders on every hit.
      { source: "/anime/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/manga/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/character/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/staff/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/voice-actors/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/studio/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/themes/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/ost/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/watch-order/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/filler/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/wiki/:path*", headers: CATALOG_CACHE_HEADERS },
      { source: "/alternatives/:path*", headers: CATALOG_CACHE_HEADERS },
      // Infinite AniList mirrors are disallowed in robots.ts. Enforce noindex
      // at the HTTP level too; section roots (/staff, /manga, /character) stay
      // indexable, only detail pages are suppressed.
      { source: "/character/:id", headers: NOINDEX_MIRROR_HEADERS },
      { source: "/character/:id/:path*", headers: NOINDEX_MIRROR_HEADERS },
      { source: "/staff/:id", headers: NOINDEX_MIRROR_HEADERS },
      { source: "/staff/:id/:path*", headers: NOINDEX_MIRROR_HEADERS },
      { source: "/manga/:id", headers: NOINDEX_MIRROR_HEADERS },
      { source: "/manga/:id/:path*", headers: NOINDEX_MIRROR_HEADERS },
    ];
  },
  async redirects() {
    return [
      // Keep only legitimate redirects - no wildcard homepage redirects
      {
        source: "/dub-schedule",
        destination: "/dubbed",
        permanent: true,
      },
      // Old /browse route -> /search. Still linked from genre empty-states,
      // so without this the internal link 404s.
      {
        source: "/browse",
        destination: "/search",
        permanent: true,
      },
      // Old locale-prefix routes (Hindi/Telugu/Tamil) - 301 to homepage so Google
      // consolidates instead of logging permanent 404s.
      {
        source: "/hi",
        destination: "/",
        permanent: true,
      },
      {
        source: "/hi/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/te",
        destination: "/",
        permanent: true,
      },
      {
        source: "/te/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/ta",
        destination: "/",
        permanent: true,
      },
      {
        source: "/ta/:path*",
        destination: "/",
        permanent: true,
      },
      // A stray "$" path (crawled as https://zyverse.in/%24) is not a real page
      // and was showing up as a permanent 404 in Search Console. Send it home.
      {
        source: "/$",
        destination: "/",
        permanent: true,
      },
      // ws.zyverse.in was an old subdomain crawled by Google; consolidate to canonical host.
      {
        source: "/:path*",
        has: [{ type: "host", value: "ws.zyverse.in" }],
        destination: "https://zyverse.in/:path*",
        permanent: true,
      },
      // www -> non-www canonicalisation (301, path preserved).
      // Canonical <link> already points to the non-www host, but Google was
      // still crawling the www copies separately (both appear in Search
      // Console). A real 301 is the correct signal to consolidate them.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.zyverse.in" }],
        destination: "https://zyverse.in/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "img.anili.st" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "uploads.mangadex.org", pathname: "/covers/**" },
      // MangaDex covers are served through this public cover-only proxy because
      // the uploads CDN challenges datacenter/browser requests with HTML.
      { protocol: "https", hostname: "apsiknb-image.hf.space", pathname: "/covers/**" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "tickets.comicconindia.com" },
      { protocol: "https", hostname: "otatokyo.jp" },
      { protocol: "https", hostname: "placewaifu.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["framer-motion"],
    proxyClientMaxBodySize: "250mb",
  },
};

export default nextConfig;
