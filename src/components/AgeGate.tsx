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
      <div className="mx-auto max-w-2xl px-4 py-24" aria-busy="true">
        <div className="h-40 animate-pulse rounded-3xl border border-white/10 bg-[var(--color-panel)]/40" />
      </div>
    );
  }

  if (state === "locked") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-4 py-16">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          className="rounded-3xl border border-[var(--color-magenta)]/40 bg-gradient-to-br from-[#1a0b14] via-[#12080f] to-[#0a0a0f] p-6 shadow-[0_0_40px_-12px_var(--color-magenta)] sm:p-8"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-magenta)] to-[var(--color-violet)] text-lg font-black text-black">
              18+
            </span>
            <div>
              <h1 id="age-gate-title" className="font-display text-2xl font-bold text-[var(--color-ink)]">
                Adults only
              </h1>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-mute)]">
                Age-restricted metadata
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-[var(--color-mute)]">
            <p>
              You are about to open {subject}, which may include mature themes,
              adult language and sexual content references. It is intended for
              people aged <strong className="text-[var(--color-ink)]">18 or older</strong>.
            </p>
            <p>
              ZyniVerse hosts <strong className="text-[var(--color-ink)]">no explicit images or video</strong>.
              This section shows catalogue metadata only and links out to lawful,
              external sources that are responsible for their own content.
            </p>
            <p>
              By continuing you confirm you are at least 18 years old and that
              viewing this material is legal where you live.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={accept}
              className="flex-1 rounded-xl bg-gradient-to-r from-[var(--color-magenta)] to-[var(--color-violet)] px-5 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
            >
              I am 18 or older — Enter
            </button>
            <Link
              href="/"
              className="flex-1 rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-white/30"
            >
              Take me back
            </Link>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-mute)]/80">
            Your choice is stored only in this browser. Clearing site data resets it.
            Read our{" "}
            <Link href="/privacy" className="underline hover:text-[var(--color-cyan)]">
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
      <div className="border-b border-[var(--color-magenta)]/25 bg-[var(--color-magenta)]/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <p className="text-xs font-medium text-[var(--color-mute)]">
            <span className="mr-2 rounded bg-[var(--color-magenta)]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--color-magenta)]">
              18+
            </span>
            Mature metadata only — no explicit media is hosted here.
          </p>
          <button
            type="button"
            onClick={exit}
            className="text-xs font-semibold text-[var(--color-mute)] underline decoration-dotted hover:text-[var(--color-ink)]"
          >
            Exit 18+ section
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
