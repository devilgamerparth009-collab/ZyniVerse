import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

const featured = [
  { href: "/challenges", emoji: "🏆", title: "Challenges", desc: "Seasonal & yearly", color: "#ff2d78", kind: "challenges", tag: "Events" },
  { href: "/forum", emoji: "💬", title: "Forums", desc: "Discuss anime", color: "#29f2e0", kind: "forums", tag: "Talks" },
  { href: "/quiz", emoji: "🧠", title: "Quiz", desc: "100+ questions", color: "#8a5cff", kind: "quiz", tag: "Brain" },
  { href: "/characters/battle", emoji: "⚔️", title: "Character Battle", desc: "Daily matchup", color: "#ff6b35", kind: "battle", tag: "Daily" },
  { href: "/critiques", emoji: "📝", title: "Critiques", desc: "Deep reviews", color: "#f59e0b", kind: "critiques", tag: "Reviews" },
] as const;

const quickLinks = [
  { href: "/blog", emoji: "✍️", label: "Blogs", color: "#f472b6" },
  { href: "/clubs", emoji: "👥", label: "Clubs", color: "#29f2e0" },
  { href: "/conventions", emoji: "📅", label: "Conventions", color: "#8a5cff" },
  { href: "/cosplay", emoji: "📸", label: "Cosplay", color: "#f59e0b" },
  { href: "/fanart", emoji: "🎨", label: "Fan Art", color: "#ff2d78" },
  { href: "/watch-party", emoji: "🎬", label: "Watch Parties", color: "#38bdf8" },
  { href: "/messages", emoji: "💬", label: "Chat", color: "#22c55e" },
] as const;

export default function CommunityHub() {
  return (
    <section className="cmty-deck" aria-labelledby="cmty-title">
      <span className="cmty-sweep" aria-hidden="true" />
      <span className="cmty-watermark" aria-hidden="true">
        <Image src="/logo.png" alt="" fill className="cmty-watermark-img" sizes="280px" />
      </span>
      <span className="cmty-corner cmty-corner--tl" aria-hidden="true" />
      <span className="cmty-corner cmty-corner--tr" aria-hidden="true" />
      <span className="cmty-corner cmty-corner--bl" aria-hidden="true" />
      <span className="cmty-corner cmty-corner--br" aria-hidden="true" />

      <div className="cmty-inner">
        <header className="cmty-head">
          <div className="cmty-head-main">
            <span className="cmty-crest">
              <Image src="/logo.png" alt="ZyniVerse" width={38} height={38} className="cmty-crest-img" />
            </span>
            <div>
              <p className="cmty-eyebrow">
                <span className="cmty-eyebrow-mark" aria-hidden="true" />
                Community
              </p>
              <h2 id="cmty-title" className="cmty-title">
                Challenges, Forums &amp; More
              </h2>
              <p className="cmty-byline">ZyniVerse Community Hub</p>
            </div>
          </div>
          <Link href="/community" className="cmty-explore">
            Explore <span aria-hidden="true">→</span>
          </Link>
        </header>

        <div className="cmty-featured">
          {featured.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`cmty-card cmty-card--${item.kind}`}
              style={
                {
                  "--cmty-accent": item.color,
                  "--cmty-i": i,
                } as CSSProperties
              }
            >
              <span className="cmty-spine" aria-hidden="true" />
              <span className="cmty-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="cmty-stamp" aria-hidden="true">
                {item.emoji}
              </span>
              <span className="cmty-copy">
                <span className="cmty-tag">{item.tag}</span>
                <span className="cmty-name">{item.title}</span>
                <span className="cmty-desc">{item.desc}</span>
              </span>
              <span className="cmty-go" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>

        <div className="cmty-quick">
          <span className="cmty-quick-label">
            <span className="cmty-quick-dot" aria-hidden="true" />
            Quick launch
          </span>
          <div className="cmty-quick-grid">
            {quickLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className="cmty-link"
                style={
                  {
                    "--cmty-accent": link.color,
                    "--cmty-i": i,
                  } as CSSProperties
                }
              >
                <span className="cmty-link-icon" aria-hidden="true">
                  {link.emoji}
                </span>
                <span>{link.label}</span>
                <span className="cmty-link-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
