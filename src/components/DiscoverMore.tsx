import Link from "next/link";
import type { CSSProperties } from "react";
import HomeMomentButton from "./HomeMomentButton";

const launchpads = [
  { href: "/filler", icon: "⏭️", label: "Skip Filler", tag: "Watch smarter", color: "#29f2e0" },
  { href: "/tools", icon: "🧰", label: "Anime Tools", tag: "Handy utilities", color: "#ff2d78" },
  { href: "/manga", icon: "📚", label: "Browse Manga", tag: "Read more", color: "#8a5cff" },
  { href: "/schedule", icon: "📅", label: "View Schedule", tag: "Never miss a drop", color: "#38bdf8" },
  { href: "/top-anime", icon: "🏆", label: "Top Anime", tag: "Community favourites", color: "#f59e0b" },
  { href: "/watchlist", icon: "🔖", label: "My Watchlist", tag: "Your personal list", color: "#22c55e" },
] as const;

function vars(values: Record<string, string | number>) {
  return values as CSSProperties;
}

export default function DiscoverMore() {
  return (
    <section className="disc-section" aria-labelledby="disc-title">
      <span className="disc-halo" aria-hidden="true" />

      <div className="disc-hero">
        <span className="disc-scan" aria-hidden="true" />
        <span className="disc-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>

        <div className="disc-hero-copy">
          <p className="disc-eyebrow">
            <span className="disc-signal" aria-hidden="true" />
            Explore ZyniVerse
          </p>
          <h2 id="disc-title" className="disc-title">Discover more on ZyniVerse</h2>
          <p className="disc-desc">
            Browse manga, explore character details, check weekly schedules, and build your personal watchlist.
          </p>
          <Link href="/manga-million" className="disc-hero-cta">
            📰 Manga Million News <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="disc-hero-art" aria-hidden="true">
          <span className="disc-paper disc-paper--one" />
          <span className="disc-paper disc-paper--two" />
          <span className="disc-paper disc-paper--three" />
          <span className="disc-live">FRESH</span>
        </div>
      </div>

      <div className="disc-grid">
        {launchpads.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className="disc-tile"
            style={vars({
              "--disc-i": index,
              "--disc-accent": item.color,
            })}
          >
            <span className="disc-tile-icon" aria-hidden="true">{item.icon}</span>
            <span className="disc-tile-copy">
              <span className="disc-tile-tag">{item.tag}</span>
              <span className="disc-tile-label">{item.label}</span>
            </span>
            <span className="disc-tile-go" aria-hidden="true">↗</span>
          </Link>
        ))}

        <div
          className="disc-tile disc-tile--moment"
          style={vars({
            "--disc-i": launchpads.length,
            "--disc-accent": "#29f2e0",
          })}
        >
          <span className="disc-tile-icon" aria-hidden="true">✦</span>
          <span className="disc-tile-copy">
            <span className="disc-tile-tag">Share your anime</span>
            <span className="disc-tile-label">Create Moments</span>
          </span>
          <span className="disc-tile-go" aria-hidden="true">↗</span>
          <span className="disc-moment"><HomeMomentButton /></span>
        </div>

        <Link
          href="/stats/wrapped"
          className="disc-tile"
          style={vars({
            "--disc-i": launchpads.length + 1,
            "--disc-accent": "#ff2d78",
          })}
        >
          <span className="disc-tile-icon" aria-hidden="true">🎌</span>
          <span className="disc-tile-copy">
            <span className="disc-tile-tag">Your year in review</span>
            <span className="disc-tile-label">My Year in Anime</span>
          </span>
          <span className="disc-tile-go" aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
