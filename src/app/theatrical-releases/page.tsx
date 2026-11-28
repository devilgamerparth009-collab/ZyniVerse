"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { PageTransition } from "@/components/PageTransition";
import TrailerModal from "@/components/TrailerModal";
import TheaterBookingModal from "@/components/TheaterBookingModal";
import { CITIES, bookingLinks, nearestCity } from "@/lib/theaters";
import type { TheatricalRelease } from "@/lib/theatrical-releases";

const STATUS_FILTERS = ["All", "Released", "Upcoming"] as const;
const STATUS_ICONS: Record<(typeof STATUS_FILTERS)[number], string> = {
  All: "✦",
  Released: "●",
  Upcoming: "◷",
};
const YEAR_FILTERS = ["All", "2026", "2025", "2024", "2023", "2022", "2021", "2019", "2017"] as const;

interface TheatricalStats {
  totalReleases: number;
  releasedInIndia: number;
  upcomingReleases: number;
  topBoxOffice: TheatricalRelease[];
  lastUpdated: string;
}

interface ApiResponse {
  releases: TheatricalRelease[];
  stats: TheatricalStats;
  total: number;
}

function formatReleaseDate(value?: string): string {
  if (!value) return "Date to be announced";
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function parseFigure(value?: string): number {
  if (!value) return 0;
  const numeric = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  if (value.includes("Lakh")) return numeric / 100;
  return numeric;
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "green" | "amber" | "violet";
}) {
  return (
    <div className={`trl-stat trl-stat-${tone}`}>
      <span className="trl-stat-glow" aria-hidden="true" />
      <p className="trl-stat-value">{value}</p>
      <p className="trl-stat-label">{label}</p>
    </div>
  );
}

function LanguageChips({ languages, limit = 99 }: { languages: string[]; limit?: number }) {
  const shown = languages.slice(0, limit);
  return (
    <div className="trl-lang-row">
      {shown.map((language) => (
        <span key={language} className="trl-lang">{language}</span>
      ))}
      {languages.length > limit && (
        <span className="trl-lang trl-lang-more">+{languages.length - limit}</span>
      )}
    </div>
  );
}

export default function TheatricalReleasesPage() {
  const [statusFilter, setStatusFilter] = useState<"All" | "Released" | "Upcoming">("All");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [releases, setReleases] = useState<TheatricalRelease[]>([]);
  const [stats, setStats] = useState<TheatricalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [bookingMovie, setBookingMovie] = useState<TheatricalRelease | null>(null);
  const [cityId, setCityId] = useState<string>(CITIES[0].id);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [locError, setLocError] = useState(false);

  const filtersActive = statusFilter !== "All" || yearFilter !== "All" || search.trim().length > 0;
  const archiveTotal = Math.max(stats?.totalReleases ?? releases.length, 1);
  const archiveProgress = Math.min(100, Math.round((releases.length / archiveTotal) * 100));

  function resetFilters() {
    setStatusFilter("All");
    setYearFilter("All");
    setSearch("");
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "All") params.set("status", statusFilter.toLowerCase());
        if (yearFilter !== "All") params.set("year", yearFilter);
        if (search) params.set("search", search);

        const res = await fetch(`/api/theatrical-releases?${params.toString()}`);
        const data: ApiResponse = await res.json();
        setReleases(data.releases);
        setStats(data.stats);
      } catch {
        setReleases([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [statusFilter, yearFilter, search]);

  const city = useMemo(() => CITIES.find((c) => c.id === cityId) ?? CITIES[0], [cityId]);
  const upcoming = useMemo(
    () => releases.filter((r) => r.status === "upcoming").sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)),
    [releases]
  );
  const spotlight = upcoming[0] ?? null;
  const indiaTop = stats?.topBoxOffice ?? [];
  const worldwideTop = useMemo(
    () => releases.filter((r) => r.boxOfficeWorldwide).sort((a, b) => parseFigure(b.boxOfficeWorldwide) - parseFigure(a.boxOfficeWorldwide)).slice(0, 10),
    [releases]
  );
  const bookingTitle = spotlight?.displayTitle ?? releases[0]?.displayTitle ?? "Anime movie";
  const quickLinks = useMemo(() => bookingLinks(bookingTitle), [bookingTitle]);

  function useMyLocation() {
    setLocating(true);
    setLocMsg(null);
    setLocError(false);
    if (!("geolocation" in navigator)) {
      setLocMsg("This browser can’t share your location. Pick a city from the list instead.");
      setLocError(true);
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestCity(pos.coords.latitude, pos.coords.longitude);
        setCityId(near.id);
        setLocMsg(`Nearest city: ${near.name}, ${near.state}`);
        setLocError(false);
        setLocating(false);
      },
      (err) => {
        if (err.code === 1) {
          setLocMsg("Location access is off for this site. Turn it on in your browser, or pick a city from the list.");
        } else if (err.code === 3) {
          setLocMsg("Location took too long. Pick a city from the list, or try again.");
        } else {
          setLocMsg("We couldn’t detect your location. Pick a city from the list, or try again.");
        }
        setLocError(true);
        setLocating(false);
      },
      { timeout: 8000, maximumAge: 600000 }
    );
  }

  return (
    <PageTransition>
      <div className="trl-root mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* ── HERO ── */}
        <section className="trl-hero relative overflow-hidden rounded-3xl p-6 sm:p-9">
          <span className="trl-hero-grid" aria-hidden="true" />
          <span className="trl-hero-orb trl-hero-orb-a" aria-hidden="true" />
          <span className="trl-hero-orb trl-hero-orb-b" aria-hidden="true" />
          <span className="trl-hero-beam" aria-hidden="true" />

          <div className="relative">
            <p className="trl-kicker">Anime movies · India</p>
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
              <span className="trl-title">Theatrical Releases</span>
            </h1>
            <p className="trl-subtitle mx-auto mt-3 max-w-2xl text-sm">
              Curated list of anime movies released in Indian theatres with box office information and streaming info.
            </p>
            {stats?.lastUpdated && (
              <p className="trl-update-pill">
                <span className="trl-update-dot" aria-hidden="true" />
                Editorial record updated {formatReleaseDate(stats.lastUpdated)}
              </p>
            )}
          </div>

          <div className="trl-note relative mt-6">
            <span className="trl-note-icon" aria-hidden="true">i</span>
            <p>
              India figures and dub/language details come from the editorial record; worldwide totals sync from Wikipedia.
              Live showtimes and seat availability open on the booking platform.
            </p>
          </div>
        </section>

        {/* ── STATS ── */}
        {stats && (
          <div className="trl-stats mt-6">
            <StatPill label="Total movies" value={stats.totalReleases} tone="cyan" />
            <StatPill label="Released" value={stats.releasedInIndia} tone="green" />
            <StatPill label="Upcoming" value={stats.upcomingReleases} tone="amber" />
            <StatPill label="Top collection" value={stats.topBoxOffice[0]?.boxOfficeIndia || "N/A"} tone="violet" />
          </div>
        )}

        {/* ── UPCOMING SPOTLIGHT ── */}
        {spotlight && (
          <section className="trl-section" aria-labelledby="trl-next-heading">
            <div className="trl-section-head">
              <div>
                <p className="trl-eyebrow">Next in theatres</p>
                <h2 id="trl-next-heading" className="trl-section-title">Upcoming spotlight</h2>
              </div>
              <button onClick={() => setBookingMovie(spotlight)} className="trl-text-link">Open venue finder →</button>
            </div>
            <div className="trl-spotlight">
              <span className="trl-spotlight-scan" aria-hidden="true" />
              <div className="trl-spotlight-body">
                <div className="trl-spotlight-poster">
                  <Image src={spotlight.image} alt={spotlight.displayTitle} fill sizes="160px" className="object-cover" />
                  <span className="trl-spotlight-ep">NEXT</span>
                </div>
                <div className="trl-spotlight-info">
                  <div className="trl-spotlight-badges">
                    <span className="trl-status trl-status-upcoming">Upcoming</span>
                    <span className="trl-spotlight-date">{formatReleaseDate(spotlight.releaseDate)}</span>
                  </div>
                  <h3 className="trl-spotlight-title">{spotlight.displayTitle}</h3>
                  <p className="trl-spotlight-meta">
                    {spotlight.distributor}{spotlight.rating ? ` · ${spotlight.rating}` : ""}
                    {spotlight.screenCount ? ` · ${spotlight.screenCount.toLocaleString("en-IN")} screens` : ""}
                  </p>
                  <p className="trl-spotlight-synopsis">{spotlight.synopsis}</p>
                  <p className="trl-mini-label">Dub / language</p>
                  <LanguageChips languages={spotlight.languages} />
                </div>
                <div className="trl-spotlight-actions">
                  {spotlight.trailerUrl && (
                    <button onClick={() => setTrailerUrl(spotlight.trailerUrl ?? null)} className="trl-btn trl-btn-primary">
                      Watch trailer
                    </button>
                  )}
                  <button onClick={() => setBookingMovie(spotlight)} className="trl-btn trl-btn-secondary">
                    Find venues
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── BOX OFFICE BOARD ── */}
        {(indiaTop.length > 0 || worldwideTop.length > 0) && (
          <section className="trl-section" aria-labelledby="trl-box-heading">
            <div className="trl-section-head">
              <div>
                <p className="trl-eyebrow">Published figures</p>
                <h2 id="trl-box-heading" className="trl-section-title">Box office board</h2>
              </div>
              <span className="trl-section-note">India from published reports · Worldwide synced from Wikipedia</span>
            </div>
            <div className="trl-board-grid">
              <div className="trl-board">
                <span className="trl-board-aura" aria-hidden="true" />
                <div className="trl-board-head">
                  <span className="trl-board-head-title">India collection</span>
                  <span className="trl-board-head-unit">₹ / Crore · Top {Math.min(10, indiaTop.length)}</span>
                </div>
                <div className="trl-board-list">
                  {indiaTop.length > 0 ? (
                    indiaTop.slice(0, 10).map((movie, idx) => (
                      <BoardRow
                        key={movie.id}
                        movie={movie}
                        index={idx}
                        value={movie.boxOfficeIndia ?? ""}
                        percent={Math.max(8, (parseFigure(movie.boxOfficeIndia) / (parseFigure(indiaTop[0]?.boxOfficeIndia) || 1)) * 100)}
                        tone="india"
                      />
                    ))
                  ) : (
                    <p className="trl-board-empty">No India figure published yet.</p>
                  )}
                </div>
              </div>
              <div className="trl-board trl-board-world">
                <span className="trl-board-aura" aria-hidden="true" />
                <div className="trl-board-head">
                  <span className="trl-board-head-title">Worldwide collection</span>
                  <span className="trl-board-head-unit">Top {Math.min(10, worldwideTop.length)} · Wikipedia</span>
                </div>
                <div className="trl-board-list">
                  {worldwideTop.length > 0 ? (
                    worldwideTop.map((movie, idx) => (
                      <BoardRow
                        key={movie.id}
                        movie={movie}
                        index={idx}
                        value={movie.boxOfficeWorldwide ?? ""}
                        percent={Math.max(8, (parseFigure(movie.boxOfficeWorldwide) / (parseFigure(worldwideTop[0]?.boxOfficeWorldwide) || 1)) * 100)}
                        tone="world"
                      />
                    ))
                  ) : (
                    <p className="trl-board-empty">No worldwide figure published yet.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── FILTERS ── */}
        <section className="trl-section" aria-labelledby="trl-library-heading">
          <div className="trl-filter-deck">
            <span className="trl-filter-aura" aria-hidden="true" />
            <div className="trl-library-head">
              <div className="trl-library-head-copy">
                <p className="trl-eyebrow">Browse the archive</p>
                <h2 id="trl-library-heading" className="trl-library-heading">Movie library</h2>
              </div>
              <div className="trl-library-actions">
                {filtersActive && (
                  <button type="button" onClick={resetFilters} className="trl-filter-reset">
                    <span aria-hidden="true">↺</span>
                    Reset
                  </button>
                )}
                <span className="trl-library-count">
                  <span className="trl-library-count-dot" aria-hidden="true" />
                  {releases.length} in view
                </span>
              </div>
            </div>

            <div className="trl-filters">
              <label className="trl-search">
                <span className="trl-search-icon" aria-hidden="true">⌕</span>
                <input
                  type="text"
                  placeholder="Search movies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search movies"
                  className="trl-search-input"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="trl-search-clear"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </label>
              <div className="trl-filter-group">
                <span className="trl-filter-label" id="trl-status-label">Status</span>
                <div className="trl-segment" role="group" aria-labelledby="trl-status-label">
                  {STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      aria-pressed={statusFilter === filter}
                      className={`trl-segment-btn ${statusFilter === filter ? "trl-segment-btn-active" : ""}`}
                    >
                      <span className="trl-segment-icon" aria-hidden="true">{STATUS_ICONS[filter]}</span>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="trl-year-row" role="group" aria-labelledby="trl-year-label">
              <span className="trl-year-label" id="trl-year-label">Year</span>
              {YEAR_FILTERS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setYearFilter(year)}
                  aria-pressed={yearFilter === year}
                  className={`trl-year-btn ${yearFilter === year ? "trl-year-btn-active" : ""}`}
                >
                  {year}
                </button>
              ))}
            </div>
            <div className="trl-filter-foot">
              <p className="trl-filter-summary" aria-live="polite">
                <span className="trl-filter-summary-icon" aria-hidden="true">▤</span>
                {loading
                  ? "Scanning the archive…"
                  : `Showing ${releases.length} of ${stats?.totalReleases ?? releases.length} titles`}
              </p>
              <span className="trl-filter-meter" aria-hidden="true">
                <span style={{ width: `${archiveProgress}%` }} />
              </span>
            </div>
          </div>

          {/* ── MOVIE GRID ── */}
          {loading ? (
            <div className="trl-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="trl-skeleton-card">
                  <div className="trl-skeleton-poster" />
                  <div className="trl-skeleton-line" />
                  <div className="trl-skeleton-line trl-skeleton-line-short" />
                </div>
              ))}
            </div>
          ) : releases.length > 0 ? (
            <div className="trl-grid" key={`${statusFilter}-${yearFilter}-${search}`}>
              {releases.map((movie, idx) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  index={idx}
                  onPlayTrailer={() => setTrailerUrl(movie.trailerUrl ?? null)}
                  onBookTickets={() => setBookingMovie(movie)}
                />
              ))}
            </div>
          ) : (
            <div className="trl-empty">
              <span className="trl-empty-icon" aria-hidden="true">⌕</span>
              <p className="trl-empty-title">No movies found</p>
              <p className="trl-empty-text">Try adjusting your filters or search query.</p>
            </div>
          )}
        </section>

        {/* ── VENUES ── */}
        <section className="trl-section" aria-labelledby="trl-venue-heading">
          <div className="trl-venues">
            <span className="trl-venue-aura" aria-hidden="true" />
            <div className="trl-venue-head">
              <div className="trl-venue-head-copy">
                <p className="trl-eyebrow">Theatres & booking</p>
                <h2 id="trl-venue-heading" className="trl-venue-heading">Where to watch</h2>
              </div>
              <p className="trl-venue-head-note">
                <span className="trl-venue-head-note-icon" aria-hidden="true">◷</span>
                Venue directory · confirm showtime on booking site
              </p>
            </div>

            <div className="trl-venue-tools">
              <label className="trl-select-wrap">
                <span className="trl-mini-label">Choose city</span>
                <span className="trl-select-shell">
                  <span className="trl-select-icon" aria-hidden="true">⌖</span>
                  <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="trl-select">
                    {CITIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} · {c.state}</option>
                    ))}
                  </select>
                  <span className="trl-select-chevron" aria-hidden="true">⌄</span>
                </span>
              </label>
              <button onClick={useMyLocation} disabled={locating} className="trl-locate-btn">
                <span aria-hidden="true">📍</span> {locating ? "Locating…" : "Near me"}
              </button>
              {locMsg && (
                <p
                  className={`trl-locate-msg${locError ? " trl-locate-msg-error" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="trl-locate-msg-icon" aria-hidden="true">{locError ? "!" : "✓"}</span>
                  <span>{locMsg}</span>
                  {locError && (
                    <button type="button" onClick={useMyLocation} className="trl-locate-retry">
                      Try again
                    </button>
                  )}
                </p>
              )}
            </div>

            <div className="trl-venue-grid">
              {city.theaters.slice(0, 6).map((theater, idx) => (
                <a
                  key={theater.id}
                  href={theater.bookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="trl-venue"
                  style={{ animationDelay: `${idx * 55}ms` }}
                >
                  <span className="trl-venue-mark" aria-hidden="true">{theater.chain.charAt(0)}</span>
                  <span className="trl-venue-copy">
                    <span className="trl-venue-name">{theater.name}</span>
                    <span className="trl-venue-meta">{theater.chain} · {theater.area}</span>
                    <span className="trl-venue-tags">
                      <span className="trl-venue-tag">{theater.screens} screens</span>
                      <span className="trl-venue-tag trl-venue-tag-action">Showtimes</span>
                    </span>
                  </span>
                  <span className="trl-venue-arrow" aria-hidden="true">↗</span>
                </a>
              ))}
            </div>

            <div className="trl-booking-links">
              <div className="trl-booking-head">
                <span className="trl-mini-label">Search “{bookingTitle}” on</span>
                <span className="trl-booking-hint">Opens the live listing</span>
              </div>
              <div className="trl-booking-row">
                {quickLinks.map((link, idx) => (
                  <a
                    key={link.id}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="trl-booking-link"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <span className="trl-booking-dot" aria-hidden="true" />
                    {link.name} <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── DATA NOTE ── */}
        <section className="trl-integrity" aria-labelledby="trl-integrity-heading">
          <span className="trl-integrity-aura" aria-hidden="true" />
          <div className="trl-integrity-head">
            <div>
              <p className="trl-eyebrow">Data integrity</p>
              <h2 id="trl-integrity-heading" className="trl-section-title">How this list stays accurate</h2>
            </div>
            <span className="trl-section-note">No invented numbers · no cached seats</span>
          </div>
          <div className="trl-integrity-grid">
            {[
              {
                mark: "₹",
                tone: "cyan",
                title: "Published figures",
                text: `India figures and dub/language details come from the editorial record; worldwide totals sync daily from Wikipedia. Last updated ${stats?.lastUpdated ?? "—"}.`,
              },
              {
                mark: "◷",
                tone: "magenta",
                title: "Live showtimes",
                text: "Showtimes and seat availability are not cached here. The booking links open the live listing for your city.",
              },
              {
                mark: "⟳",
                tone: "violet",
                title: "Auto refresh",
                text: "The curated record and worldwide figures refresh daily. Showtimes and seat counts stay on booking platforms.",
              },
            ].map((item, idx) => (
              <div
                key={item.title}
                className={`trl-integrity-item trl-integrity-item-${item.tone}`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <span className={`trl-integrity-mark trl-integrity-mark-${item.tone}`} aria-hidden="true">{item.mark}</span>
                <span className="trl-integrity-index" aria-hidden="true">{String(idx + 1).padStart(2, "0")}</span>
                <div className="trl-integrity-copy">
                  <p className="trl-integrity-title">{item.title}</p>
                  <p className="trl-integrity-text">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <TrailerModal url={trailerUrl} onClose={() => setTrailerUrl(null)} />
      {bookingMovie && (
        <TheaterBookingModal
          movieTitle={bookingMovie.displayTitle}
          onClose={() => setBookingMovie(null)}
        />
      )}
    </PageTransition>
  );
}

function BoardRow({
  movie,
  index,
  value,
  percent,
  tone,
}: {
  movie: TheatricalRelease;
  index: number;
  value: string;
  percent: number;
  tone: "india" | "world";
}) {
  const topClass = index < 3 ? ` trl-board-row-top-${index + 1}` : "";
  const sub = [movie.releaseYear, ...movie.genres.slice(0, 2)].join(" · ");

  return (
    <div
      className={`trl-board-row${topClass}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span className="trl-board-poster">
        <Image
          src={movie.image}
          alt=""
          fill
          sizes="(max-width: 640px) 64px, 60px"
          className="trl-board-poster-img"
        />
        <span className="trl-board-rank">{String(index + 1).padStart(2, "0")}</span>
      </span>
      <span className="trl-board-copy">
        <span className="trl-board-title">{movie.displayTitle}</span>
        <span className="trl-board-sub">{sub}</span>
        <span className="trl-board-value">{value}</span>
      </span>
      <span className="trl-board-bar" aria-hidden="true">
        <span
          className={`trl-board-bar-fill${tone === "world" ? " trl-board-bar-fill-alt" : ""}`}
          style={{ width: `${percent}%`, animationDelay: `${index * 70 + 120}ms` }}
        />
      </span>
    </div>
  );
}

function MovieCard({
  movie,
  index,
  onPlayTrailer,
  onBookTickets,
}: {
  movie: TheatricalRelease;
  index: number;
  onPlayTrailer: () => void;
  onBookTickets: () => void;
}) {
  return (
    <article className="trl-card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
      <div className="trl-card-poster">
        <Image
          src={movie.image}
          alt={movie.displayTitle}
          fill
          className="trl-card-image"
          loading="lazy"
          sizes="(max-width: 768px) 100vw, 400px"
        />
        <div className="trl-card-shade" aria-hidden="true" />
        <div className="trl-card-shine" aria-hidden="true" />
        <span className="trl-card-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <div className="trl-card-topline">
          <span className={`trl-status ${movie.status === "upcoming" ? "trl-status-upcoming" : "trl-status-released"}`}>
            {movie.status}
          </span>
          {movie.rating && <span className="trl-card-rating">{movie.rating}</span>}
        </div>
        <div className="trl-card-overlay">
          <h3 className="trl-card-title">{movie.displayTitle}</h3>
          <p className="trl-card-date">{formatReleaseDate(movie.releaseDate)}</p>
        </div>
      </div>

      <div className="trl-card-body">
        <div className="trl-genres">
          {movie.genres.slice(0, 4).map((genre) => (
            <span key={genre} className="trl-genre">{genre}</span>
          ))}
        </div>
        <p className="trl-synopsis">{movie.synopsis}</p>

        {(movie.boxOfficeIndia || movie.boxOfficeWorldwide) && (
          <div className="trl-metrics">
            {movie.boxOfficeIndia && (
              <div className="trl-metric">
                <span className="trl-metric-label">India</span>
                <span className="trl-metric-value trl-metric-value-green">{movie.boxOfficeIndia}</span>
              </div>
            )}
            {movie.boxOfficeWorldwide && (
              <div className="trl-metric">
                <span className="trl-metric-label">Worldwide</span>
                <span className="trl-metric-value">{movie.boxOfficeWorldwide}</span>
              </div>
            )}
          </div>
        )}

        <div className="trl-card-info">
          <div className="trl-card-detail">
            <span className="trl-mini-label">Distribution</span>
            <span className="trl-card-detail-value">{movie.distributor}</span>
          </div>
          <div className="trl-card-detail">
            <span className="trl-mini-label">Dub / language</span>
            <LanguageChips languages={movie.languages} limit={4} />
          </div>
        </div>

        <div className="trl-card-actions">
          <button onClick={onBookTickets} className="trl-btn trl-btn-primary trl-btn-book">
            Book tickets <span aria-hidden="true">↗</span>
          </button>
          {movie.trailerUrl && (
            <button onClick={onPlayTrailer} className="trl-btn trl-btn-secondary">▶ Trailer</button>
          )}
          {movie.imdbUrl && (
            <a href={movie.imdbUrl} target="_blank" rel="noopener noreferrer" className="trl-btn trl-btn-imdb">IMDb</a>
          )}
          {movie.malUrl && (
            <a href={movie.malUrl} target="_blank" rel="noopener noreferrer" className="trl-btn trl-btn-ghost">MAL</a>
          )}
        </div>
      </div>
    </article>
  );
}
