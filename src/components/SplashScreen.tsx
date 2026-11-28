"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";

const TITLE = "ZyniVerse";
const LETTERS = Array.from(TITLE);
const AUTO_HIDE_MS = 2550;
const EXIT_MS = 520;
const REDUCED_HIDE_MS = 380;

// Critical first-paint styles. In dev, the stylesheet can arrive after the
// server HTML; these keep the overlay opaque and above the page until CSS lands.
const CRITICAL_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 50% 40%, rgba(138,92,255,0.2), transparent 44%), radial-gradient(circle at 12% 16%, rgba(255,45,120,0.12), transparent 38%), radial-gradient(circle at 88% 84%, rgba(41,242,224,0.1), transparent 40%), #08080d",
  color: "#f0eef8",
  isolation: "isolate",
};

/**
 * Full-site opening screen.
 *
 * This stays in the server-rendered tree (via the root layout) so the first
 * paint is branded. There is deliberately no localStorage gate: the intro is
 * tied to a full document load, so it returns on every fresh open/refresh but
 * never interrupts client-side route transitions.
 */
export default function SplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    if (exitTimer.current === null) {
      exitTimer.current = window.setTimeout(() => setMounted(false), EXIT_MS);
    }
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(dismiss, reduceMotion ? REDUCED_HIDE_MS : AUTO_HIDE_MS);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  useEffect(() => () => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`zv-splash${leaving ? " zv-splash--leaving" : ""}`}
      style={CRITICAL_STYLE}
    >
      <button
        type="button"
        className="zv-splash__dismiss"
        aria-label="Skip opening animation"
        onClick={dismiss}
      />

      <div className="zv-splash__scene" aria-hidden="true">
        <span className="zv-splash__grid" />
        <span className="zv-splash__aurora zv-splash__aurora--magenta" />
        <span className="zv-splash__aurora zv-splash__aurora--violet" />
        <span className="zv-splash__aurora zv-splash__aurora--cyan" />
        <span className="zv-splash__blade zv-splash__blade--a" />
        <span className="zv-splash__blade zv-splash__blade--b" />

        <div className="zv-splash__core">
          <div className="zv-splash__logo">
            <span className="zv-splash__halo" />
            <span className="zv-splash__ring" />
            <Image
              src="/zyniverse-logo-3d.png"
              alt=""
              width={152}
              height={152}
              priority
              unoptimized
            />
          </div>

          <div className="zv-splash__wordmark">
            {LETTERS.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="zv-splash__letter"
                style={{ "--i": index } as CSSProperties}
              >
                {letter}
              </span>
            ))}
          </div>

          <div className="zv-splash__tagline">Discover · Track · Discuss</div>

          <div className="zv-splash__progress">
            <span />
          </div>
          <div className="zv-splash__status">opening your universe</div>
        </div>

        <div className="zv-splash__skip">tap anywhere to skip</div>
      </div>
    </div>
  );
}
