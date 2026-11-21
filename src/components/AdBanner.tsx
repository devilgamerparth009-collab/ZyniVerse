"use client";

import { useState, useEffect, useRef, useId } from "react";
import { useSession } from "next-auth/react";
import { getAdsForLocation, shouldShowAds, adsEnabled, type AdPlacement } from "@/lib/ads";
import { hasBotCookie } from "@/lib/bot-cookie";

interface AdBannerProps {
  placement: string;
  type?: "banner" | "sidebar" | "in-content" | "native" | "socialbar";
  className?: string;
}

interface ApiPlacement {
  id: string;
  type: string;
  network: string;
  code: string;
  location: string;
  isActive: boolean;
  dimensions?: { width: number; height: number } | null;
  renderMode?: string | null;
}

/**
 * One probe result is shared by every AdBanner on the page. Previously each
 * slot fired its own cross-origin request and waited up to 4s, so a page with
 * five ad slots paid that cost five times and showed five empty boxes while the
 * blockers stalled the requests.
 */
const AD_PROBE_TIMEOUT_MS = 1800;
const adProbeCache = new Map<string, boolean | Promise<boolean>>();

function probeAdNetwork(url: string): Promise<boolean> {
  const cached = adProbeCache.get(url);
  if (typeof cached === "boolean") return Promise.resolve(cached);
  if (cached) return cached;

  const pending = new Promise<boolean>((resolve) => {
    let settled = false;
    const controller =
      typeof AbortController === "undefined" ? null : new AbortController();
    const timer = setTimeout(() => finish(false), AD_PROBE_TIMEOUT_MS);

    function finish(value: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controller?.abort();
      adProbeCache.set(url, value);
      resolve(value);
    }

    fetch(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller?.signal,
    })
      .then(() => finish(true))
      .catch(() => finish(false));
  });

  adProbeCache.set(url, pending);
  return pending;
}

/**
 * Detects whether the ad network is reachable. On PCs running an ad blocker
 * (uBlock, Brave Shields, DNS-level blockers) the invoke.js request fails or
 * hangs — in that case we collapse the slot instead of leaving an empty
 * "Advertisement" box. The result is process-wide, not per slot.
 */
function useAdNetworkAvailable(code: string): boolean | null {
  const invokeUrl = code.match(/https:\/\/[^"'<\s]+invoke\.js/)?.[0] ??
    code.match(/https:\/\/[^"'<\s]+\.js/)?.[0];
  const key = invokeUrl ?? "";
  const cached = key ? adProbeCache.get(key) : undefined;
  const [available, setAvailable] = useState<boolean | null>(
    typeof cached === "boolean" ? cached : null
  );

  useEffect(() => {
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailable(true);
      return;
    }
    let cancelled = false;
    setAvailable(typeof adProbeCache.get(key) === "boolean" ? (adProbeCache.get(key) as boolean) : null);
    probeAdNetwork(key).then((result) => {
      if (!cancelled) setAvailable(result);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // No script URL to probe (e.g. custom code) — assume reachable.
  return key ? available : true;
}

/**
 * Renders an Adsterra iframe-sync ad inside a sandboxed iframe.
 * The ad scripts are injected into srcdoc so they execute in isolation.
 */
function IframeSyncAd({
  code,
  width,
  height,
}: {
  code: string;
  width: number;
  height: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: transparent;
    }
  </style>
</head>
<body>${code}</body>
</html>`;
    iframe.srcdoc = doc;
  }, [code, width, height]);

  return (
    <iframe
      ref={iframeRef}
      width={width}
      height={height}
      style={{ border: "none", overflow: "hidden", maxWidth: "100%" }}
      scrolling="no"
      title="Advertisement"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
}

/**
 * Renders an Adsterra native-async ad by injecting the script tag into the DOM.
 */
function NativeAsyncAd({ containerId }: { containerId: string }) {
  const divRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current || !divRef.current) return;
    injectedRef.current = true;

    // Create the container div that Adsterra targets
    const container = document.createElement("div");
    container.id = containerId;
    divRef.current.appendChild(container);

    // Inject the async script
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = `https://bauval.org/21/188115be46209eff2403f0d29b32d940`;
    divRef.current.appendChild(script);
  }, [containerId]);

  return <div ref={divRef} className="w-full" />;
}

export default function AdBanner({
  placement,
  className = "",
}: AdBannerProps) {
  const { data: session } = useSession();
  const [liveAds, setLiveAds] = useState<AdPlacement[] | undefined>(undefined);
  // null = bot check not resolved yet. Until it is, no ad script is injected
  // (the slot keeps its reserved height so there is no layout shift).
  const [isBot, setIsBot] = useState<boolean | null>(null);
  // Per-slot impression dedupe lives in a ref, not state: nothing in the render
  // branch depends on it, and a ref avoids a synchronous setState inside the
  // impression effect below (react-hooks/set-state-in-effect).
  const impressionSentRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  // Make a DOM-safe container id (no colons)
  const containerId = `container-188115be46209eff2403f0d29b32d940-${uniqueId.replace(/:/g, "")}`;

  const user = session?.user
    ? { premium: (session.user as { premium?: boolean }).premium === true }
    : undefined;

  const showAds = adsEnabled() && shouldShowAds(user);

  // Read the Proxy's bot flag once, on the client only. Doing it in an effect
  // keeps the server and first client render identical (no hydration drift).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsBot(hasBotCookie());
  }, []);

  // candidateAd is pure data — pulled above the early returns so every hook in
  // this component runs unconditionally (rules-of-hooks). When ads are hidden
  // (dev / premium / bot) probing the ad network is pointless, so "" short-
  // circuits useAdNetworkAvailable to "reachable" without firing a request.
  const candidateAd =
    getAdsForLocation(placement, liveAds)[0] ?? getAdsForLocation(placement)[0];
  const networkAvailable = useAdNetworkAvailable(
    showAds && isBot === false ? (candidateAd?.code ?? "") : ""
  );

  // Load the live (DB-backed) ad config once. Falls back to static defaults.
  useEffect(() => {
    if (!adsEnabled()) return;
    // Wait for the bot check; bot traffic must never fetch the ad config.
    if (isBot !== false) return;
    let cancelled = false;
    fetch("/api/ads/config")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const config: AdPlacement[] = (data?.placements || []).map((p: ApiPlacement) => ({
          id: p.id,
          type: p.type as AdPlacement["type"],
          network: p.network as AdPlacement["network"],
          code: p.code,
          location: p.location,
          isActive: p.isActive,
          dimensions: p.dimensions || undefined,
          renderMode: (p.renderMode as AdPlacement["renderMode"]) || undefined,
        }));
        setLiveAds(config);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isBot]);

  // Track impressions — at most once per page-visit per slot, so ad stats
  // stay meaningful without firing a POST + DB write on every intersection.
  useEffect(() => {
    if (isBot !== false || !showAds || impressionSentRef.current) return;
    const dedupeKey = `zy_ad_imp_${placement}_${window.location.pathname}`;
    try {
      if (sessionStorage.getItem(dedupeKey) === "1") {
        impressionSentRef.current = true;
        return;
      }
    } catch {}
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetch("/api/admin/ads/stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "impression",
              placement,
              page: window.location.pathname,
            }),
          }).catch(() => {});
          try {
            sessionStorage.setItem(dedupeKey, "1");
          } catch {}
          impressionSentRef.current = true;
        }
      },
      { threshold: 0.5 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [showAds, placement, isBot]);

  // ── Dev: never render ad containers (they inject external scripts) ─────
  if (!adsEnabled()) {
    return null;
  }

  // ── Bots: no ad markup and no ad requests at all ──────────────────────
  if (isBot === true) {
    return null;
  }

  // ── Premium users: show ad-free badge ─────────────────────────────────
  if (!showAds) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-[var(--color-line)] bg-gradient-to-r from-[var(--color-magenta)]/5 to-[var(--color-violet)]/5 py-3 px-4 ${className}`}>
        <span className="text-xs font-semibold text-[var(--color-magenta)] tracking-wide">
          ⭐ Ad-Free (Premium)
        </span>
      </div>
    );
  }

  const handleClick = () => {
    fetch("/api/admin/ads/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click",
        placement,
        page: window.location.pathname,
      }),
    }).catch(() => {});
  };

  const ads = getAdsForLocation(placement, liveAds);
  const ad = ads[0];

  // Reserve a *constant* slot height before the network probe / live config
  // resolve, so the ad box can never pop in, collapse, or resize and shift
  // the layout beneath it.
  const isNative = candidateAd?.renderMode === "native-async";
  const slotH = isNative ? 340 : (candidateAd?.dimensions?.height ?? 90) + 16;

  // ── No ad configured / network blocked / bot check pending: keep the
  // reserved slot (no CLS) and inject nothing until we know it is a human ─
  if (!ad || networkAvailable === false || isBot === null) {
    return (
      <div
        ref={containerRef}
        className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--color-line)]/20 bg-[var(--color-panel)]/30 ${className}`}
        style={{ height: slotH, maxHeight: slotH, contain: "layout paint" }}
      >
        <AdLabel />
      </div>
    );
  }

  // ── Native async ad ───────────────────────────────────────────────────
  if (ad.renderMode === "native-async") {
    return (
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`relative w-full overflow-hidden rounded-xl ${className}`}
        style={{ height: 340, maxHeight: 340, overflow: "hidden", contain: "layout paint" }}
      >
        <AdLabel />
        <NativeAsyncAd containerId={containerId} />
      </div>
    );
  }

  // ── iframe-sync ad (728×90 leaderboard or 300×250 rectangle) ──────────
  const w = ad.dimensions?.width ?? 728;
  const h = ad.dimensions?.height ?? 90;

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative flex flex-col items-center overflow-hidden rounded-xl border border-[var(--color-line)]/40 bg-[var(--color-panel)]/60 backdrop-blur-sm py-2 ${className}`}
      style={{ height: h + 16, maxHeight: h + 16, contain: "layout paint" }}
    >
      <AdLabel />
      <div className="pt-1">
        <IframeSyncAd code={ad.code} width={w} height={h} />
      </div>
    </div>
  );
}

function AdLabel() {
  return (
    <span className="block text-center text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--color-mute)] pb-1 select-none pointer-events-none">
      Advertisement
    </span>
  );
}