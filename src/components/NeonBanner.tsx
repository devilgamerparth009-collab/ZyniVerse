import type { CSSProperties } from "react";
import Link from "next/link";

const FEATURES = [
  { icon: "⏭️", label: "Skip Filler", tone: "var(--color-cyan)" },
  { icon: "🧭", label: "Watch in the Right Order", tone: "var(--color-violet)" },
  { icon: "📺", label: "Track Indian TV & Dubs", tone: "var(--color-amber)" },
  {
    icon: "✨",
    label: "Discover Your Next Favorite Anime",
    tone: "var(--color-magenta)",
  },
];

const STATS = [
  "200+ Anime",
  "39 Watch Orders",
  "Filler Guides",
  "Cosplay",
  "Challenges",
];

export default function NeonBanner() {
  return (
    <section className="cmp-wrap" aria-labelledby="cmp-title">
      <div className="cmp-panel">
        <span className="cmp-aurora cmp-aurora--a" aria-hidden="true" />
        <span className="cmp-aurora cmp-aurora--b" aria-hidden="true" />
        <span className="cmp-grid" aria-hidden="true" />

        <div className="cmp-inner">
          <p className="cmp-kicker">
            <span className="cmp-kicker-dot" aria-hidden="true" />
            Your anime command center
          </p>

          <h2 id="cmp-title" className="cmp-title">
            The Ultimate <span className="cmp-title-accent">Anime Companion</span>
          </h2>

          <div className="cmp-features">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.label}
                className="cmp-feature"
                style={
                  {
                    "--cmp-i": i,
                    "--cmp-tone": feature.tone,
                  } as CSSProperties
                }
              >
                <span className="cmp-feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <span className="cmp-feature-label">{feature.label}</span>
              </div>
            ))}
          </div>

          <div className="cmp-bottom">
            <div className="cmp-stats">
              {STATS.map((stat) => (
                <span key={stat} className="cmp-stat">
                  {stat}
                </span>
              ))}
            </div>

            <Link href="/search" className="cmp-cta">
              <span className="cmp-cta-label">Explore Now</span>
              <span className="cmp-cta-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
