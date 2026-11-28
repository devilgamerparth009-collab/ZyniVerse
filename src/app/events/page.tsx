import type { Metadata } from "next";
import { getEventsPageData } from "@/lib/anime-events";
import EventFilters from "@/components/EventFilters";
import AnnouncementsSection from "@/components/AnnouncementsSection";
import EventHero from "@/components/EventHero";
import FeaturedEventCard from "@/components/FeaturedEventCard";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Anime Events & Announcements — Conventions, Expo, Premieres",
  description:
    "Track anime conventions, expos, and festivals worldwide with dates and venues checked against organiser sources.",
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Anime Events & Announcements",
    description:
      "Track anime events worldwide with source-checked dates and venues.",
  },
};

export default async function AnimeEventsPage() {
  let {
    events = [],
    types = [],
    countries = [],
    meta = {
      totalEvents: 0,
      disclaimer: "Dates and venue details are checked against official event pages where available. Unverified attendance and announcements are not shown.",
      lastUpdated: "N/A",
      source: "official + curated",
    },
    announcements = [],
    upcoming = [],
  } = {} as Awaited<ReturnType<typeof getEventsPageData>>;

  try {
    ({ events, types, countries, meta, announcements, upcoming } = await getEventsPageData());
  } catch {
    // Fallback to empty arrays — the page renders with an honest empty state.
  }

  const verifiedCount = events.filter((event) => event.sourceTone === "official").length;
  const sourceLinks = [...upcoming, ...events.filter((event) => event.status !== "upcoming")].slice(0, 4);

  return (
    <div className="evp-page">
      <EventHero
        eventsCount={events.length}
        countriesCount={countries.length}
        verifiedCount={verifiedCount}
        lastUpdated={meta.lastUpdated}
      />

      <div className="evp-shell">
        <aside className="evp-source-note">
          <span className="evp-source-note-glow" aria-hidden="true" />
          <div className="evp-source-note-rail" aria-hidden="true">
            <span className="evp-source-note-seal">
              <span className="evp-source-note-seal-ring" />✓
            </span>
            <span className="evp-source-note-line" />
          </div>
          <div className="evp-source-note-body">
            <div className="evp-source-note-head">
              <p className="evp-source-note-title">Source-checked listings</p>
              <span className="evp-source-note-mode">
                <span className="evp-source-note-mode-dot" />
                {meta.source || "official + curated"}
              </span>
            </div>
            <p className="evp-source-note-text">{meta.disclaimer}</p>
            <p className="evp-source-note-meta">
              <span className="evp-source-note-meta-icon" aria-hidden="true">↻</span>
              Status updates automatically from dates · Last checked {meta.lastUpdated}
            </p>
          </div>
        </aside>

        {upcoming.length > 0 && (
          <section className="evp-section">
            <div className="evp-section-head evp-section-head-featured">
              <div className="evp-section-head-main">
                <p className="evp-eyebrow">On the horizon</p>
                <h2 className="evp-section-title">Next up</h2>
                <span className="evp-section-underline" aria-hidden="true" />
              </div>
              <div className="evp-section-aside">
                <span className="evp-section-count">
                  <span className="evp-section-count-dot" />
                  {upcoming.length} upcoming
                </span>
                <span className="evp-section-track" aria-hidden="true">
                  {upcoming.slice(0, Math.min(upcoming.length, 5)).map((item) => (
                    <i key={item.id} />
                  ))}
                </span>
              </div>
            </div>
            <FeaturedEventCard event={upcoming[0]} position={1} total={upcoming.length} />
          </section>
        )}

        <section className="evp-section">
          <div className="evp-section-head evp-section-head-ann">
            <div className="evp-section-head-main">
              <p className="evp-eyebrow">Verified only</p>
              <h2 className="evp-section-title">Announcements</h2>
              <span className="evp-section-underline" aria-hidden="true" />
            </div>
            <span
              className={`evp-section-count ${
                announcements.length === 0 ? "evp-section-count-zero" : ""
              }`}
            >
              <span className="evp-section-count-dot" />
              {announcements.length} sourced
            </span>
          </div>

          {announcements.length > 0 ? (
            <AnnouncementsSection events={events} />
          ) : (
            <div className="evp-source-empty">
              <span className="evp-source-empty-scan" aria-hidden="true" />
              <div className="evp-source-empty-lead">
                <span className="evp-source-empty-seal" aria-hidden="true">
                  <span className="evp-source-empty-orbit" />
                  <span className="evp-source-empty-orbit evp-source-empty-orbit-b" />
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3 4.5 6v5.5c0 4.7 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.8 7.5-9.5V6L12 3Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
                <div>
                  <p className="evp-source-empty-kicker">Source ledger · empty</p>
                  <p className="evp-source-empty-title">No verified announcements right now</p>
                  <p className="evp-source-empty-text">
                    We only publish reveals that link back to a traceable organiser source.
                  </p>
                </div>
              </div>
              {sourceLinks.length > 0 && (
                <div className="evp-source-links">
                  <p className="evp-source-links-label">Check organiser pages</p>
                  <div className="evp-source-links-row">
                    {sourceLinks.map((event) => (
                      <a
                        key={event.id}
                        href={event.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="evp-source-link"
                      >
                        {event.shortName || event.name}
                        <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="evp-divider" aria-hidden="true">
          <span className="evp-divider-pip" />
          <span>All events</span>
          <span className="evp-divider-pip" />
        </div>

        <section className="evp-section">
          <div className="evp-archive-head">
            <span className="evp-archive-index" aria-hidden="true">03</span>
            <div className="evp-archive-copy">
              <p className="evp-eyebrow">Browse the archive</p>
              <h2 className="evp-section-title">All events</h2>
            </div>
            <span className="evp-archive-count">
              <span className="evp-section-count-dot" />
              {events.length} tracked
            </span>
          </div>
          <EventFilters events={events} types={types} countries={countries} />
        </section>

        <footer className="evp-footer">
          <span className="evp-footer-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <span className="evp-footer-copy">
            <strong>Source-first anime event tracking.</strong>
            <span>Always confirm schedules and tickets on the official event site.</span>
          </span>
          <span className="evp-footer-status" aria-hidden="true">
            <span className="evp-footer-status-dot" />
            Verified sources
          </span>
        </footer>
      </div>
    </div>
  );
}
