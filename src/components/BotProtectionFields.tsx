"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export interface BotProtectionPayload {
  website: string;
  startedAt: number;
  turnstileToken: string;
}

/**
 * Web-form bot fields. With no Turnstile keys configured this only emits a
 * honeypot and a minimum-fill timestamp; the server decides which checks apply.
 * When a public site key is present the Turnstile widget is rendered on demand.
 */
export function useBotProtectionFields(): {
  fields: BotProtectionPayload;
  element: React.ReactNode;
} {
  const startedAt = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    if (!document.getElementById("cf-turnstile-script")) {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const poll = window.setInterval(() => {
      const turnstile = (window as Window & {
        turnstile?: {
          render: (
            el: HTMLElement,
            options: Record<string, unknown>
          ) => string;
        };
      }).turnstile;
      if (!turnstile || !containerRef.current || widgetId.current) return;
      widgetId.current = turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
      });
      window.clearInterval(poll);
    }, 200);

    return () => window.clearInterval(poll);
  }, []);

  const element = (
    <>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="absolute -left-[9999px] h-px w-px opacity-0"
        aria-hidden="true"
      />
      <input type="hidden" name="startedAt" value={startedAt.current} readOnly />
      <input type="hidden" name="turnstileToken" value={turnstileToken} readOnly />
      {SITE_KEY && (
        <div className="flex justify-center">
          <div ref={containerRef} data-sitekey={SITE_KEY} />
        </div>
      )}
    </>
  );

  return {
    fields: { website, startedAt: startedAt.current, turnstileToken },
    element,
  };
}
