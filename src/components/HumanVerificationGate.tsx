"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HUMAN_VERIFICATION_EVENT,
  HUMAN_VERIFICATION_KEY,
} from "@/lib/safe-json";

const TTL = 24 * 60 * 60 * 1000;
const HUMAN_VERIFIED_EVENT = "zyni:human-verified";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isVerified() {
  try {
    const t = Number(localStorage.getItem(HUMAN_VERIFICATION_KEY) || "0");
    return t > Date.now() - TTL;
  } catch {
    return false;
  }
}

function isGateExempt(pathname: string) {
  if (pathname === "/verify-human") return true;
  // Auth forms stay reachable on a first visit. Bot fields, rate limiting and
  // email verification still protect them; the full-screen check used to hide
  // the login/register UI from creators before they could even try signing in.
  if (pathname === "/login" || pathname === "/register") return true;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    (pathname === "/login" && params.get("mobile") === "1") ||
    pathname === "/auth/mobile-done"
  );
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(HUMAN_VERIFIED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(HUMAN_VERIFIED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export default function HumanVerificationGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [requiredByEvent, setRequiredByEvent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // External "verification required" signals must override a still-valid flag.
  useEffect(() => {
    const onVerificationRequired = () => {
      if (isGateExempt(pathname)) return;
      setRequiredByEvent(true);
    };
    window.addEventListener(HUMAN_VERIFICATION_EVENT, onVerificationRequired);
    return () => window.removeEventListener(HUMAN_VERIFICATION_EVENT, onVerificationRequired);
  }, [pathname]);

  const verified = useSyncExternalStore(
    subscribe,
    () => isGateExempt(pathname) || (!requiredByEvent && isVerified()),
    () => true,
  );

  const onVerify = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const c = await fetch("/api/verify-human", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }).then((r) => r.json());
      const nonce = String(c?.nonce || "");
      if (!nonce) throw new Error("no nonce");
      const answer = await sha256Hex(`human:${nonce}`);
      const res = await fetch("/api/verify-human", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error("failed");
      try {
        localStorage.setItem(HUMAN_VERIFICATION_KEY, String(Date.now()));
      } catch {
        /* storage can be disabled; the session still verifies */
      }
      setRequiredByEvent(false);
      window.dispatchEvent(new Event(HUMAN_VERIFIED_EVENT));
      router.refresh();
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (verified) return null;

  return (
    <div
      className="zvg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zvg-title"
      aria-describedby="zvg-desc"
    >
      <div className="zvg-backdrop" aria-hidden="true">
        <span className="zvg-grid" />
        <span className="zvg-orb zvg-orb--a" />
        <span className="zvg-orb zvg-orb--b" />
      </div>

      <div className="zvg-card">
        <div className="zvg-emblem" aria-hidden="true">
          <span className="zvg-emblem-ring" />
          <span className="zvg-emblem-ring zvg-emblem-ring--b" />
          <svg viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="zvg-shield" x1="8" y1="4" x2="40" y2="44">
                <stop stopColor="#ff2d78" />
                <stop offset="0.52" stopColor="#8a5cff" />
                <stop offset="1" stopColor="#29f2e0" />
              </linearGradient>
            </defs>
            <path
              d="M24 4.5 39 10v11.2c0 10.1-6.2 18.2-15 22.3-8.8-4.1-15-12.2-15-22.3V10l15-5.5Z"
              fill="url(#zvg-shield)"
              fillOpacity="0.16"
              stroke="url(#zvg-shield)"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="m17.2 24.2 4.7 4.7 9.2-10.2"
              stroke="url(#zvg-shield)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="zvg-eyebrow">ZyniVerse · secure access</div>
        <h1 id="zvg-title">Human Verification</h1>
        <p id="zvg-desc">
          One quick check to make sure it&apos;s really you, not a bot. No personal data needed.
        </p>

        <div className="zvg-trust">
          <span className="zvg-trust-dot" />
          encrypted challenge · trusted for 24 hours
        </div>

        <button
          type="button"
          className="zvg-button"
          onClick={onVerify}
          disabled={loading}
          aria-busy={loading}
        >
          <span className="zvg-button-label">
            {loading ? (
              <>
                <span className="zvg-spinner" aria-hidden="true" />
                Verifying…
              </>
            ) : (
              <>
                I am human
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </span>
        </button>

        {error && (
          <div className="zvg-error" role="alert">
            <span className="zvg-error-mark" aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        <p className="zvg-foot">protected by ZyniVerse verification</p>
      </div>
    </div>
  );
}
