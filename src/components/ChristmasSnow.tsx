"use client";

import { useMemo, useSyncExternalStore } from "react";

/** 1–25 December, inclusive, in the visitor's local time. */
export function isChristmasWindow(date = new Date()): boolean {
  return date.getMonth() === 11 && date.getDate() >= 1 && date.getDate() <= 25;
}

type Flake = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
  glyph: string;
};

const GLYPHS = ["❄", "❅", "❆", "•"];

/** Deterministic pseudo-random value in [0, 1) for a flake index and field. */
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Sitewide snowfall for the Christmas window.
 *
 * Additive only: it renders `null` outside 1–25 December and is
 * `pointer-events-none`, so navigation, scrolling and clicks are untouched.
 * Mounted after hydration so the server and client always agree on the date.
 */
export default function ChristmasSnow({ count = 18 }: { count?: number }) {
  // Hydration-safe mount flag: server renders false, client flips to true
  // after hydration without a cascading state update in an effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const flakes = useMemo<Flake[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: seeded(i, 1) * 100,
        size: 7 + seeded(i, 2) * 11,
        delay: seeded(i, 3) * 12,
        duration: 11 + seeded(i, 4) * 14,
        drift: -20 + seeded(i, 5) * 40,
        opacity: 0.25 + seeded(i, 6) * 0.45,
        glyph: GLYPHS[i % GLYPHS.length],
      })),
    [count]
  );

  if (!mounted || !isChristmasWindow()) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden motion-reduce:hidden"
    >
      <style>{`
        @keyframes zy-snow-fall {
          0%   { transform: translate3d(0, -10vh, 0); }
          100% { transform: translate3d(var(--zy-drift, 0px), 110vh, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .zy-snowflake { animation: none !important; }
        }
      `}</style>
      {flakes.map((flake, i) => (
        <span
          key={i}
          className="zy-snowflake absolute top-0 select-none text-sky-100"
          style={{
            left: `${flake.left}%`,
            fontSize: `${flake.size}px`,
            opacity: flake.opacity,
            // @ts-expect-error CSS custom property
            "--zy-drift": `${flake.drift}px`,
            animation: `zy-snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
            willChange: "transform",
          }}
        >
          {flake.glyph}
        </span>
      ))}
    </div>
  );
}
