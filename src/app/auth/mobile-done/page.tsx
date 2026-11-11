"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Landing page for OAuth started from the mobile app.
 *
 * Two hand-off modes are supported:
 *  - `?redirect=zyniverse://auth` (Android Custom Tabs): we bounce the session
 *    cookie to the app's deep link, which `openAuthSessionAsync` catches.
 *  - otherwise, inside the legacy in-app WebView we postMessage the cookie.
 */
export default function MobileDonePage() {
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const res = await fetch("/api/auth/mobile-token", { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (data?.ok && data.cookie) {
          setName(data.user?.name || data.user?.email || null);

          // Deep-link hand-off for Android Custom Tabs. Validate the target so
          // this page can never be used as an open redirect.
          const params = new URLSearchParams(window.location.search);
          const requested = params.get("redirect");
          const safeRedirect =
            requested && /^zyniverse:\/\/auth(\?|$)/.test(requested) ? requested : null;
          if (safeRedirect) {
            const sep = safeRedirect.includes("?") ? "&" : "?";
            setState("done");
            window.location.replace(
              `${safeRedirect}${sep}cookie=${encodeURIComponent(data.cookie)}`
            );
            return;
          }

          // Tell the native WebView (present only inside the legacy flow).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rn = (window as any).ReactNativeWebView;
          if (rn?.postMessage) {
            rn.postMessage(JSON.stringify({ type: "zyni-auth", cookie: data.cookie }));
            setState("done");
            return;
          }
          // Opened in a normal browser: just head home.
          window.location.replace("/");
          return;
        }
        setState("failed");
      } catch {
        if (!cancelled) setState("failed");
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-void)] px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-[#00ffe0]/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-[#ff00e6]/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px] rounded-[24px] border border-white/10 bg-[var(--color-panel)]/70 p-8 text-center backdrop-blur-xl"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00ffe0]/30 bg-[#00ffe0]/10 text-3xl">
          {state === "failed" ? "⚠️" : "🔐"}
        </div>

        <h1 className="font-display text-xl font-bold text-[var(--color-ink)]">
          {state === "working"
            ? "Finishing sign-in…"
            : state === "done"
              ? `Signed in${name ? ` as ${name}` : ""}`
              : "Could not finish sign-in"}
        </h1>

        <p className="mt-2 text-sm text-[var(--color-mute)]">
          {state === "working"
            ? "Hang tight while we hand your session to the app."
            : state === "done"
              ? "You can close this window — the app will take you back automatically."
              : "The session cookie was missing. Please try signing in again."}
        </p>

        {state === "failed" && (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-xl bg-[#00ffe0] px-5 py-2.5 text-sm font-bold text-[#061014]"
          >
            Back to sign in
          </Link>
        )}

        {state === "done" && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#00ffe0]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#00ffe0]" />
            Session transferred
          </div>
        )}
      </motion.div>
    </main>
  );
}
