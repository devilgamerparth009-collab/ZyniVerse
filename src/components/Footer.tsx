"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { t } from "@/lib/i18n";
import FeedbackForm from "./FeedbackForm";

const SOCIAL_LINKS = [
  { label: "YouTube", href: "https://www.youtube.com/@Itz_parth_2007", icon: "youtube" },
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61584572784224", icon: "facebook" },
  { label: "Instagram", href: "https://www.instagram.com/gupta.parth1015/", icon: "instagram" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/guptaparth2857/", icon: "linkedin" },
  { label: "Twitter", href: "https://x.com/GuptaParth2857", icon: "twitter" },
];

const SOCIAL_PATHS: Record<string, string> = {
  youtube: "M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33zM9.75 15.02V8.48l5.75 3.27z",
  facebook: "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",
  instagram: "M17 2H7a5 5 0 00-5 5v10a5 5 0 005 5h10a5 5 0 005-5V7a5 5 0 00-5-5zm-5 14a5 5 0 110-10 5 5 0 010 10zm0-12a7 7 0 100 14 7 7 0 000-14zm6-2a1 1 0 110 2 1 1 0 010-2z",
  linkedin: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 110-4 2 2 0 010 4z",
  twitter: "M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z",
};

interface FooterLink { href: string; label: string; icon: string; external?: boolean; }
interface FooterColumn { title: string; links: FooterLink[]; }

const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE;

const LINK_COLUMNS: FooterColumn[] = [
  {
    title: "Browse",
    links: [
      { href: "/about", label: "About ZyniVerse", icon: "book" },
      { href: "/search", label: "Explore Anime", icon: "search" },
      { href: "/top-anime", label: "Top Anime", icon: "award" },
      { href: "/manga", label: "Manga", icon: "book" },
      { href: "/seasonal", label: "Seasonal", icon: "calendar" },
      { href: "/schedule", label: "Schedule", icon: "clock" },
      { href: "/live-action", label: "Live Action", icon: "film" },
      { href: "/dubbed", label: "Regional Dubs", icon: "globe" },
      { href: "/indian-dubs", label: "Indian Dubs", icon: "globe" },
      { href: "/hindi-dub", label: "Hindi Dub Library", icon: "globe" },
      { href: "/random", label: "Random Anime", icon: "shuffle" },
      { href: "/a-z", label: "A–Z Index", icon: "list" },
      { href: "/moments", label: "Moments", icon: "image" },
    ],
  },
  {
    title: "Content",
    links: [
      { href: "/guides", label: "Guides & Articles", icon: "edit" },
      { href: "/podcast", label: "Podcast", icon: "mic" },
      { href: "/merch", label: "Merch Store", icon: "shopping-bag" },
      { href: "/filler", label: "Filler Guides", icon: "edit" },
      { href: "/watch-order", label: "Watch Orders", icon: "list" },
      { href: "/tools", label: "Tools", icon: "bar-chart" },
      { href: "/extension", label: "Chrome Extension", icon: "code" },
      { href: "/toons", label: "Toons & Cartoons", icon: "tv" },
      { href: "/tv-schedule", label: "TV Channels", icon: "globe" },
      { href: "/changelog", label: "Changelog", icon: "edit" },
      { href: "/blog", label: "Blog", icon: "edit" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/forum", label: "Forum", icon: "message-circle" },
      { href: "/posts", label: "Posts", icon: "image" },
      { href: "/clubs", label: "Clubs", icon: "users" },
      { href: "/people", label: "Find People", icon: "user-plus" },
      { href: "/channels", label: "Channels", icon: "message-circle" },
      { href: "/stories", label: "Stories", icon: "image" },
      { href: "/polls", label: "Polls", icon: "bar-chart" },
      { href: "/critiques", label: "Critiques", icon: "edit" },
      { href: "/activity", label: "Activity Feed", icon: "zap" },
      { href: "/conventions", label: "Conventions", icon: "calendar" },
      { href: "/characters", label: "Characters", icon: "users" },
      { href: "/characters/battle", label: "Character Battle", icon: "zap" },
      { href: "/fanart", label: "Fan Art", icon: "palette" },
      { href: "/leaderboard", label: "Leaderboard", icon: "bar-chart" },
      ...(DISCORD_INVITE
        ? [{ href: DISCORD_INVITE, label: "Discord Server", icon: "message-circle", external: true }]
        : []),
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/watchlist", label: "My List", icon: "list" },
      { href: "/manga-list", label: "My Manga", icon: "book" },
      { href: "/profile", label: "Profile", icon: "user" },
      { href: "/saved", label: "Saved Posts", icon: "bookmark" },
      { href: "/stats", label: "My Stats", icon: "bar-chart" },
      { href: "/stats/wrapped", label: "Wrapped", icon: "sparkles" },
      { href: "/login", label: "Login", icon: "log-in" },
      { href: "/register", label: "Register", icon: "user-plus" },
      { href: "/premium", label: "Premium", icon: "award" },
      { href: "/docs", label: "API Docs", icon: "code" },
      { href: "/wiki", label: "Wiki", icon: "book" },
      { href: "/status", label: "Status", icon: "bar-chart" },
      { href: "/best-anime-sites", label: "Best Anime Sites", icon: "globe" },
      { href: "/link-to-us", label: "Link to Us", icon: "globe" },
    ],
  },
];

const COLUMN_ACCENTS = ["#29f2e0", "#ff2d78", "#8a5cff", "#f59e0b"];

const ICON_PATHS: Record<string, string> = {
  "search": "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  "book": "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z",
  "calendar": "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  "clock": "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  "bar-chart": "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  "globe": "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "message-circle": "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  "edit": "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  "shuffle": "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  "users": "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  "award": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  "list": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  "user": "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  "bookmark": "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
  "image": "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9a1 1 0 100-2 1 1 0 000 2z",
  "log-in": "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1",
  "user-plus": "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm13 0v6m-3-3h6",
  "code": "M16 18l6-6-6-6M8 6l-6 6 6 6",
  "film": "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z",
  "tv": "M9.75 17.9l4.4-2.2c.4-.2.9-.2 1.3 0l4.4 2.2V4a1 1 0 00-1-1H5.3a1 1 0 00-1 1v13.9zM3 5h18v14H3V5z",
  "mic": "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8",
  "shopping-bag": "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  "zap": "M13 2L3 14h7l-1 8 10-12h-7z",
  "palette": "M12 3a9 9 0 100 18h1.5a2.5 2.5 0 002.5-2.5c0-.7-.3-1.3-.8-1.8-.4-.4-.7-1-.7-1.7a2 2 0 012-2H19a2 2 0 002-2A9 9 0 0012 3zM7.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z",
  "sparkles": "M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 13l.7 1.8L7.5 15.5l-1.8.7L5 18l-.7-1.8L2.5 15.5l1.8-.7z",
};

const QUICK_LINKS = [
  { label: "Browse Anime", href: "/search" },
  { label: "Guides", href: "/guides" },
  { label: "Theatrical", href: "/theatrical-releases" },
  { label: "Toons", href: "/toons" },
  { label: "Podcast", href: "/podcast" },
  { label: "Merch", href: "/merch" },
  { label: "Forum", href: "/forum" },
  { label: "Filler Guides", href: "/filler" },
  { label: "Watch Orders", href: "/watch-order" },
  { label: "Changelog", href: "/changelog" },
  { label: "18+ Hub", href: "/mature" },
  { label: "API Docs", href: "/docs" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
  { label: "Developer", href: "/developer" },
];

function vars(values: Record<string, string | number>) {
  return values as CSSProperties;
}

function Glyph({ path, size = 12 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export default function Footer() {
  const [year, setYear] = useState(2026);
  const pathname = usePathname();
  // Anime detail pages keep visitors inside the app: no social/support exits.
  const hideExternalExits = pathname?.startsWith("/anime/") ?? false;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setYear(new Date().getFullYear()); }, []);

  return (
    <footer className="zft-footer">
      <span className="zft-beam" aria-hidden="true" />
      <span className="zft-grid" aria-hidden="true" />

      <div className="zft-shell">
        <section className="zft-brand-panel" aria-label="About ZyniVerse">
          <span className="zft-radar" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>

          <div className="zft-brand-main">
            <Link href="/" className="zft-brand">
              <span className="zft-brand-mark">
                <Image src="/logo.png" alt="ZyniVerse" width={48} height={48} className="zft-brand-img" />
                <span className="zft-brand-ring" aria-hidden="true" />
              </span>
              <span className="zft-brand-name">ZyniVerse</span>
            </Link>

            <p className="zft-brand-tagline">
              Discover, track, and discuss anime &amp; manga. Your ultimate anime companion for Indian fans.
            </p>

            <div className="zft-meta">
              <Link href="/contact" className="zft-chip">
                <Glyph path="M22 4H2v16h20zM22 4l-10 8L2 4" size={11} />
                Contact Us
              </Link>
              <span className="zft-chip zft-chip--static">
                <Glyph path="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 10a3 3 0 100 6 3 3 0 000-6z" size={11} />
                Delhi, India
              </span>
            </div>

            {!hideExternalExits && (
              <div className="zft-socials" aria-label="ZyniVerse social links">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zft-social"
                    aria-label={social.label}
                  >
                    <Glyph path={SOCIAL_PATHS[social.icon]} size={14} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="zft-brand-visual" aria-hidden="true">
            <span className="zft-visual-card zft-visual-card--one" />
            <span className="zft-visual-card zft-visual-card--two" />
            <span className="zft-visual-card zft-visual-card--three" />
            <span className="zft-visual-core">ZY</span>
            <span className="zft-visual-tag">ANIME · MANGA · COMMUNITY</span>
          </div>
        </section>

        <nav className="zft-atlas" aria-label="Footer navigation">
          {LINK_COLUMNS.map((column, columnIndex) => (
            <section
              key={column.title}
              className="zft-column"
              style={vars({
                "--zft-col": columnIndex,
                "--zft-accent": COLUMN_ACCENTS[columnIndex],
              })}
            >
              <div className="zft-column-head">
                <span className="zft-column-index">{String(columnIndex + 1).padStart(2, "0")}</span>
                <h2 className="zft-column-title">{t(`footer.col.${column.title.toLowerCase()}`)}</h2>
                <span className="zft-column-line" aria-hidden="true" />
              </div>

              <ul className="zft-link-list">
                {column.links
                  .filter((link) => !hideExternalExits || !link.external)
                  .map((link, linkIndex) => {
                    const content = (
                      <>
                        <Glyph path={ICON_PATHS[link.icon] ?? ICON_PATHS.book} />
                        <span className="zft-link-label">{link.label}</span>
                        {link.external && <span className="zft-link-arrow">↗</span>}
                      </>
                    );

                    return (
                      <li key={link.href} style={vars({ "--zft-i": linkIndex })}>
                        {link.external ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="zft-link"
                          >
                            {content}
                          </a>
                        ) : (
                          <Link href={link.href} className="zft-link">
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="zft-cta-row">
          <section className="zft-cta zft-cta--support">
            <span className="zft-cta-icon" aria-hidden="true">
              <Glyph path={ICON_PATHS.award} size={18} />
            </span>
            <div className="zft-cta-copy">
              <h2 className="zft-cta-title">Support ZyniVerse</h2>
              <p className="zft-cta-desc">Help us keep running — no ads, just passion.</p>
            </div>
            <div className="zft-actions">
              {!hideExternalExits && (
                <a
                  href="https://www.buymeacoffee.com/zyniverse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zft-action zft-action--magenta"
                >
                  Buy me a coffee
                </a>
              )}
              <Link href="/premium" className="zft-action zft-action--cyan">Go Premium</Link>
            </div>
          </section>

          <section className="zft-cta zft-cta--community">
            <span className="zft-cta-icon" aria-hidden="true">
              <Glyph path={ICON_PATHS["message-circle"]} size={18} />
            </span>
            <div className="zft-cta-copy">
              <h2 className="zft-cta-title">Join the Discussion</h2>
              <p className="zft-cta-desc">Share reviews, critiques, and connect with anime fans.</p>
            </div>
            <div className="zft-actions">
              <Link href="/community" className="zft-action zft-action--cyan">Explore Community</Link>
            </div>
          </section>
        </div>

        <section className="zft-feedback" aria-label="Send feedback">
          <p className="zft-feedback-label">
            <span aria-hidden="true" />
            Send Feedback
          </p>
          <FeedbackForm />
        </section>

        <section className="zft-shortcuts" aria-label="Quick links">
          <div>
            <h2 className="zft-shortcut-title">Quick links</h2>
            <div className="zft-pills">
              {QUICK_LINKS.map((link, index) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="zft-pill"
                  style={vars({ "--zft-i": index })}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="zft-shortcuts--legal">
            <h2 className="zft-shortcut-title">Legal</h2>
            <div className="zft-pills">
              {LEGAL_LINKS.map((link, index) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="zft-pill"
                  style={vars({ "--zft-i": index })}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="zft-bottom">
        <div className="zft-bottom-inner">
          <p className="zft-bottom-note">
            <span className="zft-bottom-dot" aria-hidden="true" />
            &copy; {year} ZyniVerse. All rights reserved.
          </p>
          <p className="zft-bottom-note zft-bottom-note--muted">
            Made with care for anime fans. No content is hosted here.
          </p>
          {!hideExternalExits && (
            <a
              href="https://www.promotebusinessdirectory.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="zft-bottom-link"
            >
              Promote Business Directory
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
