"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

function useCountUp(target: number, duration = 1000, start = false): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  // A missing or malformed count must never become "NaN" in the UI.
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;

  useEffect(() => {
    if (!start || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => {
        fromRef.current = safeTarget;
        setValue(safeTarget);
      });
      return () => cancelAnimationFrame(frame);
    }
    const from = fromRef.current;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (safeTarget - from) * eased);
      fromRef.current = next;
      setValue(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Background tabs throttle rAF; this guarantees the final value is shown.
    const settle = window.setTimeout(() => {
      fromRef.current = safeTarget;
      setValue(safeTarget);
    }, duration + 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
  }, [safeTarget, duration, start]);

  return value;
}

// SSR-safe: server and first client render both show 9:41, then local time takes over.
function useLiveClock() {
  const [clock, setClock] = useState({ time: "9:41", seconds: "" });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = now.getHours() % 12 || 12;
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setClock({ time: `${hours}:${minutes}`, seconds });
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return clock;
}

const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

interface EventHeroProps {
  eventsCount: number;
  countriesCount: number;
  verifiedCount: number;
  lastUpdated: string;
}

export default function EventHero({
  eventsCount,
  countriesCount,
  verifiedCount,
  lastUpdated,
}: EventHeroProps) {
  const reduceMotion = useReducedMotion();
  const [inView, setInView] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const { time, seconds } = useLiveClock();

  useEffect(() => {
    const element = statsRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.35 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const events = useCountUp(eventsCount, 1000, inView);
  const countries = useCountUp(countriesCount, 1000, inView);
  const verified = useCountUp(verifiedCount, 1000, inView);

  const safeCount = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const maxCount = Math.max(
    safeCount(eventsCount),
    safeCount(countriesCount),
    safeCount(verifiedCount),
    1
  );
  const fillFor = (value: number) => `${Math.max(14, (safeCount(value) / maxCount) * 100)}%`;

  return (
    <section className="evp-hero">
      <div className="evp-hero-grid" aria-hidden="true" />
      <div className="evp-hero-beam" aria-hidden="true" />
      <div className="evp-hero-orb evp-hero-orb-a" aria-hidden="true" />
      <div className="evp-hero-orb evp-hero-orb-b" aria-hidden="true" />

      <div className="evp-hero-inner">
        <motion.div
          variants={heroStagger}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          className="evp-hero-copy"
        >
          <motion.div variants={heroItem} className="evp-hero-kicker">
            <span className="evp-hero-pulse" />
            Live tracking · official-first
          </motion.div>
          <motion.h1 variants={heroItem} className="evp-hero-title">
            Anime <span>Events Hub</span>
          </motion.h1>
          <motion.p variants={heroItem} className="evp-hero-lead">
            Conventions, expos and festivals worldwide. Dates and venues are checked against
            organiser pages before they appear here — no invented attendance, no unsourced reveals.
          </motion.p>
          <motion.div variants={heroItem} className="evp-hero-meta">
            <span className="evp-hero-meta-dot" />
            Sources last checked {lastUpdated} · statuses update automatically
          </motion.div>
        </motion.div>

        <motion.div
          ref={statsRef}
          initial={reduceMotion ? false : { opacity: 0, y: 30, scale: 0.94 }}
          animate={inView || reduceMotion ? { opacity: 1, y: 0, scale: 1 } : undefined}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="evp-phone-stage"
        >
          <div className="evp-phone-aura" aria-hidden="true" />
          <div className="evp-phone-ring evp-phone-ring-a" aria-hidden="true" />
          <div className="evp-phone-ring evp-phone-ring-b" aria-hidden="true" />

          <div className="evp-duo">
            <div className="evp-duo-frame">
              {/* Folded left pane — live coverage visual */}
              <div className="evp-duo-pane evp-duo-pane-visual" aria-hidden="true">
                <div className="evp-duo-aurora" />
                <div className="evp-duo-grid" />
                <div className="evp-duo-logo" aria-hidden="true">
                  <Image
                    src="/zyniverse-logo-3d.png"
                    alt=""
                    width={512}
                    height={512}
                    priority
                  />
                </div>
                <div className="evp-duo-orbit evp-duo-orbit-c" />
                <div className="evp-duo-orbit evp-duo-orbit-b" />
                <div className="evp-duo-orbit evp-duo-orbit-a" />
                <span className="evp-duo-node evp-duo-node-a" />
                <span className="evp-duo-node evp-duo-node-b" />
                <span className="evp-duo-node evp-duo-node-c" />
                <span className="evp-duo-visual-label">
                  <span className="evp-duo-visual-dot" />
                  coverage signal
                </span>
              </div>

              {/* Titanium hinge / soft crease */}
              <div className="evp-duo-crease" aria-hidden="true">
                <span />
              </div>

              {/* Flat right pane — the app UI */}
              <div className="evp-duo-pane evp-duo-pane-ui">
                <div className="evp-duo-screen">
                  <div className="evp-duo-scan" aria-hidden="true" />

                  <div className="evp-duo-status" aria-hidden="true">
                    <span className="evp-duo-time">
                      {time}
                      {seconds && <span className="evp-duo-seconds">:{seconds}</span>}
                    </span>
                    <span className="evp-duo-status-icons">
                      <span />
                      <span />
                      <span />
                      <span className="evp-duo-battery" />
                    </span>
                  </div>

                  <div className="evp-duo-appbar">
                    <span className="evp-duo-app">ZyniVerse</span>
                    <span className="evp-duo-live">
                      <span className="evp-hero-pulse" aria-hidden="true" />
                      live
                    </span>
                  </div>

                  <div className="evp-duo-screen-head">
                    <p className="evp-duo-kicker">Coverage snapshot</p>
                    <p className="evp-duo-sub">daily refresh · checked {lastUpdated}</p>
                  </div>

                  <div className="evp-duo-dashboard">
                    <div className="evp-duo-spotlight">
                      <span className="evp-duo-spotlight-chip">auto status</span>
                      <span className="evp-duo-spotlight-label">events tracked</span>
                      <span className="evp-duo-spotlight-value">
                        {safeCount(events).toLocaleString("en-US")}
                      </span>
                      <svg className="evp-duo-spark" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
                        <defs>
                          <linearGradient id="evpSparkGradient" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#29f2e0" />
                            <stop offset="55%" stopColor="#8a5cff" />
                            <stop offset="100%" stopColor="#ff2d78" />
                          </linearGradient>
                        </defs>
                        <path
                          className="evp-duo-spark-area"
                          d="M0 22 C12 20 18 12 28 15 S45 8 56 11 S72 3 84 8 S102 5 120 2 L120 28 L0 28 Z"
                        />
                        <path
                          className="evp-duo-spark-line"
                          d="M0 22 C12 20 18 12 28 15 S45 8 56 11 S72 3 84 8 S102 5 120 2"
                        />
                      </svg>
                    </div>

                    <div className="evp-duo-mini-grid">
                      <div className="evp-duo-mini evp-duo-mini-violet">
                        <span className="evp-duo-mini-icon" aria-hidden="true">◎</span>
                        <span className="evp-duo-mini-value">{safeCount(countries)}</span>
                        <span className="evp-duo-mini-label">countries</span>
                        <span className="evp-duo-mini-bar" aria-hidden="true">
                          <span style={{ width: fillFor(countriesCount) }} />
                        </span>
                      </div>
                      <div className="evp-duo-mini evp-duo-mini-magenta">
                        <span className="evp-duo-mini-icon" aria-hidden="true">◇</span>
                        <span className="evp-duo-mini-value">{safeCount(verified)}</span>
                        <span className="evp-duo-mini-label">official sources</span>
                        <span className="evp-duo-mini-bar" aria-hidden="true">
                          <span style={{ width: fillFor(verifiedCount) }} />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="evp-duo-footer">
                    <span className="evp-duo-footer-dot" aria-hidden="true" />
                    source-checked listings
                    <span aria-hidden="true">↗</span>
                  </div>
                </div>

                {/* Brand watermark kept fully inside the right pane. */}
                <div className="evp-duo-watermark" aria-hidden="true">
                  <span>ZyniVerse</span>
                </div>
              </div>

              {/* Dual Fusion camera bump peeking from the outer edge */}
              <div className="evp-duo-cameras" aria-hidden="true">
                <span className="evp-duo-lens" />
                <span className="evp-duo-lens" />
                <span className="evp-duo-flash" />
              </div>

            </div>
          </div>

          <div className="evp-phone-chip evp-phone-chip-a" aria-hidden="true">
            ✓ verified
          </div>
          <div className="evp-phone-chip evp-phone-chip-b" aria-hidden="true">
            auto status
          </div>
        </motion.div>
      </div>
    </section>
  );
}
