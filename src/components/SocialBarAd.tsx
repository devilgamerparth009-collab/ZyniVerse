"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { shouldShowAds, adsEnabled } from "@/lib/ads";
import { hasBotCookie } from "@/lib/bot-cookie";

/**
 * Adsterra Social Bar — a floating sticky widget that appears on all pages.
 * It's an ANTI-ADBLOCK script so it runs directly in the page (not sandboxed).
 * Only injected once per page, only for non-premium users.
 */
export default function SocialBarAd() {
  const { data: session } = useSession();
  const injectedRef = useRef(false);
  // null = bot check pending; never inject the floating widget for crawlers.
  const [isBot, setIsBot] = useState<boolean | null>(null);

  const user = session?.user
    ? { premium: Boolean((session.user as Record<string, unknown>).premium) }
    : undefined;

  const showAds = adsEnabled() && shouldShowAds(user);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsBot(hasBotCookie());
  }, []);

  useEffect(() => {
    // Never inject ad scripts while developing locally.
    if (!adsEnabled()) return;
    // Wait until the Proxy bot check has resolved.
    if (isBot !== false) return;
    // Wait until we know the premium status (session loaded)
    if (session === undefined) return; // still loading
    if (!showAds) return;             // premium user
    if (injectedRef.current) return;  // already injected

    // Social bar is a global widget — defer it until after the page has
    // settled so it never competes with first-paint/LCP or the main thread.
    const inject = () => {
      if (injectedRef.current) return;
      injectedRef.current = true;

      const script = document.createElement("script");
      script.src =
        "https://formssternlystately.com/79/88/46/798846c18dea1cf9f50c54e73acf1380.js";
      script.type = "text/javascript";
      document.head.appendChild(script);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(inject, 2000);
    };
    const onLoad = () => {
      window.removeEventListener("load", onLoad);
      schedule();
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", onLoad);
    }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("load", onLoad);
    };
  }, [showAds, session, isBot]);

  // This component renders nothing visible itself
  return null;
}
