"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";

const DEFAULT_KEY = "zyniverse:age-verified";

type GateState = "checking" | "locked" | "unlocked";

/**
 * Tiny same-tab store around localStorage.
 *
 * `storage` events only fire in *other* tabs, so the module-level listener set
 * is what lets "Enter" / "Exit" re-render this gate immediately. The in-memory
 * map keeps the gate usable when storage is blocked (private mode, hardened
 * browsers) for the lifetime of the page.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Keep the in-memory value so the choice still applies to this page view.
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readState(key: string): GateState {
  return readRaw(key) === "true" ? "unlocked" : "locked";
}

interface AgeGateProps {
  children: ReactNode;
  /** localStorage key. Use a distinct key for each gated surface. */
  storageKey?: string;
  /** Short line describing what sits behind the gate. */
  subject?: string;
}

/**
 * Client-side 18+ gate.
 *
 * Renders nothing but the interstitial until the visitor confirms they are an
 * adult. The confirmation is stored in localStorage (no cookie, no server
 * round-trip, no personal data), and the gated surface is still `noindex` on
 * the server so search engines never receive the content.
 *
 * Deliberately not a legal age-verification system: ZyniVerse only publishes
 * metadata and links to lawful external sources, so an honesty-based gate plus
 * a clear content warning is the appropriate control.
 */
export default function AgeGate({
  children,
  storageKey = DEFAULT_KEY,
  subject = "this section",
}: AgeGateProps) {
  // Server snapshot is "checking" so SSR never renders gated content and
  // hydration matches; the real value is read on the client immediately after.
  const state = useSyncExternalStore(
    subscribe,
    () => readState(storageKey),
    () => "checking" as GateState,
  );

  const accept = () => {
    writeRaw(storageKey, "true");
    notify();
  };

  const exit = () => {
    writeRaw(storageKey, null);
    notify();
  };

  if (state === "checking") {
    return (
      <div className="agv-checking" aria-busy="true">
        <div className="agv-skeleton">
          <span className="agv-skeleton-chip" />
          <span className="agv-skeleton-line agv-skeleton-line-lg" />
          <span className="agv-skeleton-line" />
          <span className="agv-skeleton-line agv-skeleton-line-sm" />
        </div>
      </div>
    );
  }

  if (state === "locked") {
    return (
      <main className="agv-page">
        <span className="agv-orb agv-orb-left" aria-hidden="true" />
        <span className="agv-orb agv-orb-right" aria-hidden="true" />
        <span className="agv-grid" aria-hidden="true" />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          aria-describedby="age-gate-copy"
          className="agv-card"
        >
          <span className="agv-scan" aria-hidden="true" />

          <div className="agv-topline">
            <span className="agv-kicker">
              <span className="agv-kicker-dot" aria-hidden="true" />
              Age check required
            </span>
            <span className="agv-code" aria-hidden="true">
              ZV · 18+
            </span>
          </div>

          <div className="agv-head">
            <div className="agv-seal" aria-hidden="true">
              <span className="agv-seal-ring" />
              <span className="agv-seal-core">18+</span>
            </div>
            <div className="agv-head-copy">
              <h1 id="age-gate-title" className="agv-title">
                Adults only
              </h1>
              <p className="agv-subtitle">Age-restricted metadata</p>
            </div>
          </div>

          <div id="age-gate-copy" className="agv-copy">
            <p>
              You are about to open {subject}, which may include mature themes,
              adult language and sexual content references. It is intended for
              people aged <strong>18 or older</strong>.
            </p>
            <p>
              ZyniVerse hosts <strong>no explicit images or video</strong>. This
              section shows catalogue metadata only and links out to lawful,
              external sources that are responsible for their own content.
            </p>
            <p>
              By continuing you confirm you are at least 18 years old and that
              viewing this material is legal where you live.
            </p>
          </div>

          <div className="agv-actions">
            <button type="button" onClick={accept} className="agv-btn agv-btn-primary">
              <span>I am 18 or older — Enter</span>
            </button>
            <Link href="/" className="agv-btn agv-btn-secondary">
              <span>Take me back</span>
            </Link>
          </div>

          <p className="agv-privacy">
            Your choice is stored only in this browser. Clearing site data resets
            it. Read our{" "}
            <Link href="/privacy" className="agv-privacy-link">
              privacy policy
            </Link>
            .
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="agv-banner">
        <span className="agv-banner-glow" aria-hidden="true" />
        <div className="agv-banner-inner">
          <p className="agv-banner-copy">
            <span className="agv-badge">18+</span>
            <span className="agv-banner-shield" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M12 3l7 3v5.5c0 4.6-3 8.2-7 9.5-4-1.3-7-4.9-7-9.5V6l7-3z" />
                <path d="M9.5 12.2l1.7 1.7 3.4-3.6" />
              </svg>
            </span>
            <span className="agv-banner-text">Mature metadata only — no explicit media is hosted here.</span>
          </p>
          <button type="button" onClick={exit} className="agv-exit">
            <span>Exit 18+ section</span>
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
