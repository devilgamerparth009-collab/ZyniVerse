import type { Metadata } from "next";
import ConventionCalendar from "@/components/ConventionCalendar";
import ConventionMap from "@/components/ConventionMap";
import styles from "./conventions.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";
const SOURCE_CHECK = "28 Nov 2026";

export const metadata: Metadata = {
  title: "Anime Conventions India 2026–27 — Comic Con, Events & Meetups Calendar",
  description:
    "Organiser-verified calendar of anime conventions, comic cons and otaku events in India for 2026–27. Official dates, venues and ticket links for Comic Con India, Ōta TOKYO and Anime India.",
  keywords: [
    "anime conventions india 2026", "anime conventions india 2027", "comic con india 2026",
    "comic con hyderabad 2026", "comic con delhi 2026", "comic con chennai 2027",
    "anime events in bangalore 2027", "anime events india", "comic con india",
    "ota tokyo delhi 2026", "anime india 2027", "otaku events india",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Anime Conventions India 2026–27 — Organiser-Verified Calendar",
    description: "Organiser-verified anime conventions and comic cons across India for 2026–27. Dates, venues and ticket info.",
    url: `${BASE_URL}/conventions`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Conventions India 2026–27",
    description: "Organiser-verified anime conventions and comic cons across India for 2026–27.",
  },
  alternates: {
    canonical: `${BASE_URL}/conventions`,
  },
  robots: { index: true, follow: true },
};

export default function ConventionsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.gridVeil} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.container}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Events • India 2026–27</span>
          <h1 className={styles.heroTitle}>
            Anime Conventions <span className={styles.heroTitleAccent}>in India</span>
          </h1>
          <p className={styles.subtitle}>
            Organiser-verified comic cons and anime events across India for 2026–27.
            Dates, venues and ticket links checked against official pages.
          </p>
          <div className={styles.sourceNote}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>
              Source check: {SOURCE_CHECK}. Status labels refresh automatically from stored dates;
              official organiser and ticket fields are checked daily and published only through
              trusted-source guards.
            </span>
          </div>
        </header>

        <section className={styles.section} aria-labelledby="convention-calendar-heading">
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionKicker}>Explore</span>
              <h2 id="convention-calendar-heading" className={styles.sectionTitle}>Convention Calendar</h2>
              <p className={styles.sectionSub}>Filter by city, month and status — then open an event for verified details.</p>
            </div>
          </div>
          <ConventionCalendar />
        </section>

        <section className={styles.section} aria-labelledby="convention-location-heading">
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionKicker}>Near you</span>
              <h2 id="convention-location-heading" className={styles.sectionTitle}>Conventions by Location</h2>
              <p className={styles.sectionSub}>Browse verified events by state and city — all 36 states &amp; UTs included.</p>
            </div>
          </div>
          <ConventionMap />
        </section>

        <p className={styles.footer}>ZYNIVERSE • v2.4.1 • ENCRYPTED</p>
      </div>
    </main>
  );
}
