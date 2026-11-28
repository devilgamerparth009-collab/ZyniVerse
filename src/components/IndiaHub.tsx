import Link from "next/link";
import type { CSSProperties } from "react";
import { DUBBED_ANIME_STATIC } from "@/lib/data/dubbed-static";
import { INDIAN_DUB_GUIDES } from "@/lib/indian-dub-guides";
import styles from "./IndiaHub.module.css";

export interface IndiaHubDubStats {
  total: number;
  languages: number;
  genres: number;
  scheduleCount: number;
  updatedAt: string | null;
}

export interface IndiaHubDubLanguage {
  language: string;
  slug: string;
  total: number;
}

export interface IndiaHubDubGenre {
  genre: string;
  total: number;
}

export interface IndiaHubProps {
  dub?: {
    stats: IndiaHubDubStats;
    languages: IndiaHubDubLanguage[];
    genres: IndiaHubDubGenre[];
  };
}

// Mirrors the APK's Dub Hub tabs. The web equivalents are static routes, so
// every chip leads to crawlable HTML instead of a client-only filter state.
const HUB_TABS = [
  { href: "/hindi-dub", emoji: "✨", label: "All" },
  { href: "/hindi-dub/series", emoji: "📺", label: "Series" },
  { href: "/hindi-dub/movies", emoji: "🎬", label: "Movies" },
  { href: "/hindi-dub/schedule", emoji: "⏱", label: "Live Schedule" },
  { href: "/hindi-dub#languages", emoji: "🌐", label: "Languages" },
  { href: "/hindi-dub#genres", emoji: "🎭", label: "Genres" },
] as const;

// The one thing no competitor tracks: Indian-language anime. This band is
// deliberately placed high on the homepage. The hero follows the APK's
// "DUB HUB" layout, and the cards below keep the wider India rail intact.
export default function IndiaHub({ dub }: IndiaHubProps) {
  const hindiCount = DUBBED_ANIME_STATIC.filter((d) => d.hasHindi).length;
  const tamilCount = DUBBED_ANIME_STATIC.filter((d) => d.hasTamil).length;
  const teluguCount = DUBBED_ANIME_STATIC.filter((d) => d.hasTelugu).length;
  const indianCount = DUBBED_ANIME_STATIC.filter(
    (d) => d.hasHindi || d.hasTamil || d.hasTelugu,
  ).length;
  const guideCount = INDIAN_DUB_GUIDES.length;

  // Static fallbacks keep the section useful if the dub catalogue is briefly
  // unavailable during an ISR refresh. The live numbers arrive from the same
  // `getDubOverview()` helper the app uses.
  const fallbackGenreCounts = new Map<string, number>();
  for (const item of DUBBED_ANIME_STATIC) {
    for (const genre of item.genres) {
      fallbackGenreCounts.set(genre, (fallbackGenreCounts.get(genre) ?? 0) + 1);
    }
  }
  const fallbackGenres: IndiaHubDubGenre[] = [...fallbackGenreCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([genre, total]) => ({ genre, total }));
  const fallbackLanguages: IndiaHubDubLanguage[] = [
    { language: "Hindi", slug: "hindi", total: hindiCount },
    { language: "Tamil", slug: "tamil", total: tamilCount },
    { language: "Telugu", slug: "telugu", total: teluguCount },
  ];

  const stats = dub?.stats ?? {
    total: indianCount,
    languages: fallbackLanguages.length,
    genres: fallbackGenres.length,
    scheduleCount: 0,
    updatedAt: null,
  };
  const languages = dub?.languages?.length ? dub.languages : fallbackLanguages;
  const genres = dub?.genres?.length ? dub.genres : fallbackGenres;
  const visibleLanguages = languages.slice(0, 8);
  const visibleGenres = genres.slice(0, 8);
  const maxLanguageCount = Math.max(
    1,
    ...visibleLanguages.map((language) => language.total),
  );
  const maxGenreCount = Math.max(
    1,
    ...visibleGenres.map((genre) => genre.total),
  );

  const cards = [
    {
      href: "/hindi-dub",
      emoji: "🇮🇳",
      title: "Hindi Hub",
      desc: `${stats.total.toLocaleString("en-IN")} titles · series · movies`,
      color: "#ff9933",
    },
    {
      href: "/indian-dubs",
      emoji: "📊",
      title: "Indian Dub Meter",
      desc: `${Math.max(hindiCount, 60)}+ anime tracked`,
      color: "#e84a5f",
    },
    {
      href: "/indian-dubs",
      emoji: "🏛️",
      title: "Tamil & Telugu",
      desc: `${tamilCount}+ Tamil · ${teluguCount}+ Telugu`,
      color: "#e84a5f",
    },
    {
      href: `/indian-dubs`,
      emoji: "📚",
      title: "Dub Guides",
      desc: `${guideCount} deep-dive guides`,
      color: "#6c63ff",
    },
    {
      href: "/voice-actors/indian",
      emoji: "🎙️",
      title: "Indian VAs",
      desc: "Meet the voice artists",
      color: "#29f2e0",
    },
    {
      href: "/conventions",
      emoji: "📅",
      title: "Conventions",
      desc: "Anime events in India",
      color: "#8a5cff",
    },
    {
      href: "/filler",
      emoji: "⏭️",
      title: "Filler Guides",
      desc: "200+ anime, episode-by-episode",
      color: "#ff2d78",
    },
    {
      href: "/watch-order",
      emoji: "📺",
      title: "Watch Orders",
      desc: "50 anime, correct sequence",
      color: "#3b82f6",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* APK-style Dub Hub hero: eyebrow, title, subtitle and three stats. */}
      <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 ${styles.hero}`}>
        <div aria-hidden className={styles.aurora} />
        <div aria-hidden className={styles.sweep} />
        <div aria-hidden className={styles.floaters}>
          <span>✦</span>
          <span>🇮🇳</span>
          <span>▶</span>
        </div>
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className={`font-mono text-xs font-bold uppercase tracking-[0.22em] ${styles.eyebrow}`}>
              <span aria-hidden className={styles.tricolor}>
                <i />
                <i />
                <i />
              </span>
              DUB HUB
              <span aria-hidden className={styles.livePill}>
                <span className={styles.liveDot} />
              </span>
            </p>
            <h2 className={`mt-2 font-display text-3xl font-black leading-tight sm:text-4xl ${styles.title}`}>
              Dubbed favourites, all in one place
            </h2>
            <p className={`mt-2 text-sm leading-relaxed sm:text-base ${styles.subtitle}`}>
              Browse series, films and weekly airings across the languages you
              love. Filter by language, genre or release order.
            </p>
          </div>
          <Link
            href="/hindi-dub"
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-bold ${styles.cta}`}
          >
            Open Dub Hub <span aria-hidden className={styles.ctaArrow}>→</span>
          </Link>
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Titles", value: stats.total },
            { label: "Languages", value: stats.languages },
            { label: "Genres", value: stats.genres },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl px-3 py-4 text-center sm:px-5 ${styles.stat}`}
            >
              <p className={`text-xl font-black sm:text-2xl ${styles.statValue}`}>
                {stat.value.toLocaleString("en-IN")}
              </p>
              <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${styles.statLabel}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className={`relative z-10 mt-5 flex flex-wrap gap-2 ${styles.tabs}`} aria-label="Dub Hub sections">
          {HUB_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${styles.tab}`}
            >
              <span aria-hidden>{tab.emoji}</span> {tab.label}
            </Link>
          ))}
        </div>

        {(languages.length > 0 || genres.length > 0) && (
          <div className={`relative z-10 mt-5 space-y-3 border-t pt-5 ${styles.panel}`}>
            {languages.length > 0 && (
              <div className={`flex flex-wrap items-center gap-2 ${styles.chips}`}>
                <span className={`mr-1 text-[10px] font-bold uppercase tracking-wider ${styles.chipLabel}`}>
                  Languages
                </span>
                {visibleLanguages.map((language) => (
                  <Link
                    key={language.slug}
                    href={`/hindi-dub/languages/${language.slug}`}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles.chip} ${styles.languageChip}`}
                  >
                    {language.language}
                    {language.total > 0 && (
                      <span className={styles.chipCount}>{language.total}</span>
                    )}
                    <span aria-hidden className={styles.chipBar}>
                      <span
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round((language.total / maxLanguageCount) * 100),
                          )}%`,
                        }}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {genres.length > 0 && (
              <div className={`flex flex-wrap items-center gap-2 ${styles.chips}`}>
                <span className={`mr-1 text-[10px] font-bold uppercase tracking-wider ${styles.chipLabel}`}>
                  Genres
                </span>
                {visibleGenres.map((genre) => (
                  <Link
                    key={genre.genre}
                    href={`/hindi-dub/series?genre=${encodeURIComponent(genre.genre)}`}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles.chip} ${styles.genreChip}`}
                  >
                    {genre.genre}
                    <span className={styles.chipCount}>{genre.total}</span>
                    <span aria-hidden className={styles.chipBar}>
                      <span
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round((genre.total / maxGenreCount) * 100),
                          )}%`,
                        }}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`relative z-10 mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${styles.footer}`}>
          {stats.scheduleCount > 0 && (
            <Link
              href="/hindi-dub/schedule"
              className={`font-semibold ${styles.liveLink}`}
            >
              <span aria-hidden className={styles.footerDot} />
              ⏱ {stats.scheduleCount.toLocaleString("en-IN")} airings tracked · Live schedule →
            </Link>
          )}
          {stats.updatedAt && (
            <span className={styles.sync}>
              Last synced {new Date(stats.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} IST
            </span>
          )}
        </div>
      </div>

      <div className={styles.sectionHead}>
        <div>
          <p className={styles.sectionEyebrow}>🇮🇳 India&apos;s Anime Hub</p>
          <h3 className={styles.sectionTitle}>
            Hindi, Tamil &amp; Telugu — tracked weekly
          </h3>
        </div>
        <Link href="/indian-dubs" className={styles.viewAll}>
          View all <span aria-hidden className={styles.viewAllArrow}>→</span>
        </Link>
      </div>

      <div className={styles.hubGrid}>
        {cards.map((card, index) => (
          <Link
            key={card.title + card.href}
            href={card.href}
            className={styles.hubCard}
            style={
              {
                "--card-accent": card.color,
                "--card-index": index,
              } as CSSProperties
            }
          >
            <div className={styles.cardTop}>
              <span className={styles.cardIcon} aria-hidden>
                {card.emoji}
              </span>
              <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <p className={styles.cardTitle}>{card.title}</p>
            <p className={styles.cardDesc}>{card.desc}</p>
            <div className={styles.cardFooter}>
              <span className={styles.cardArrow} aria-hidden>→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
