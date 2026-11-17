import type { Metadata } from "next";
import Link from "next/link";
import { getDubCatalog, getDubLanguages, getDubSchedule, getDubStats } from "@/lib/dub-import/queries";
import { DubTitleGrid } from "@/components/hindi-dub/DubTitleCard";
import NativeBannerAd from "@/components/NativeBannerAd";

export const revalidate = 1800;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Hindi Dub Anime Library — Series, Movies & Weekly Schedule (2026)",
  description:
    "Complete Hindi, Tamil, Telugu, Bengali, Malayalam and Kannada dub catalogue: anime series, movies and the weekly Hindi dub airing schedule, imported and auto-updated from Indian dub sources.",
  keywords: [
    "hindi dub anime", "hindi dubbed anime list", "anime in hindi", "hindi dub schedule",
    "tamil dub anime", "telugu dub anime", "regional dub anime india", "hindi dub movies",
    "anime hindi me", "dubbed anime india", "hindi dub catalogue",
  ],
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "ZyniVerse — anime filler guides, watch orders and dub tracking" }],
    title: "Hindi Dub Anime Library — Series, Movies & Schedule",
    description: "Every Hindi and regional dub in one place: series, movies, languages and the weekly airing schedule.",
    url: `${BASE_URL}/hindi-dub`,
    type: "website",
    siteName: "ZyniVerse",
  },
  alternates: { canonical: `${BASE_URL}/hindi-dub` },
  robots: { index: true, follow: true },
};

function formatAiring(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default async function HindiDubHubPage() {
  const [stats, languages, recentSeries, recentMovies, schedule] = await Promise.all([
    getDubStats(),
    getDubLanguages(),
    getDubCatalog({ kind: "series", sort: "recent", limit: 12 }),
    getDubCatalog({ kind: "movie", sort: "recent", limit: 12 }),
    getDubSchedule({ limit: 200 }),
  ]);

  const upcoming = [...schedule]
    .filter((row) => row.releaseAt)
    .sort((a, b) => (a.releaseAt! < b.releaseAt! ? -1 : 1))
    .slice(0, 6);

  const quickLinks = [
    { href: "/hindi-dub/schedule", label: "Weekly schedule", hint: `${stats.scheduleCount} airings tracked`, accent: "var(--color-cyan)" },
    { href: "/hindi-dub/series", label: "Anime series", hint: `${stats.series.toLocaleString("en-IN")} titles`, accent: "var(--color-violet)" },
    { href: "/hindi-dub/movies", label: "Dub movies", hint: `${stats.movies.toLocaleString("en-IN")} titles`, accent: "var(--color-magenta)" },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 sm:p-10">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-violet), transparent 70%)" }}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cyan)]">
          Hindi &amp; regional dub library
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight text-[var(--color-ink)] sm:text-5xl">
          Har Hindi dub, ek hi jagah — series, movies aur weekly schedule.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)] sm:text-base">
          ZyniVerse Indian dub sources se sirf catalogue metadata import karta hai (title, languages, poster,
          air time) aur original page ka link deta hai. Naya episode ya title source par aate hi yahan
          automatically update ho jata hai.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Titles", value: stats.total.toLocaleString("en-IN") },
            { label: "Series", value: stats.series.toLocaleString("en-IN") },
            { label: "Movies", value: stats.movies.toLocaleString("en-IN") },
            { label: "Languages", value: String(stats.languages) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[var(--color-line)] bg-black/20 px-4 py-3">
              <p className="text-2xl font-black text-[var(--color-ink)]">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-mute)]">{stat.label}</p>
            </div>
          ))}
        </div>

        {stats.updatedAt && (
          <p className="mt-3 text-[11px] text-[var(--color-mute)]">
            Last synced {new Date(stats.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </p>
        )}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 transition hover:border-[var(--color-violet)]/60"
          >
            <p className="text-base font-bold text-[var(--color-ink)] transition group-hover:text-[var(--color-cyan)]">
              {link.label}
            </p>
            <p className="mt-1 text-xs text-[var(--color-mute)]">{link.hint}</p>
            <span className="mt-3 inline-block h-1 w-10 rounded-full" style={{ background: link.accent }} />
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">Browse by language</h2>
          <Link href="/hindi-dub/series" className="text-xs text-[var(--color-cyan)] hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {languages.map((language) => (
            <Link
              key={language.slug}
              href={`/hindi-dub/languages/${language.slug}`}
              className="rounded-full border border-[var(--color-line)] bg-black/20 px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:border-[var(--color-cyan)]/60"
            >
              {language.language}
              <span className="ml-1.5 text-[10px] text-[var(--color-mute)]">{language.total}</span>
            </Link>
          ))}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">Next on air</h2>
            <Link href="/hindi-dub/schedule" className="text-xs text-[var(--color-cyan)] hover:underline">
              Full schedule →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[var(--color-line)]">
            {upcoming.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-2.5">
                <span className="w-24 shrink-0 text-xs font-semibold text-[var(--color-cyan)]">
                  {formatAiring(row.releaseAt) ?? row.dayLabel}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-ink)]">{row.title}</span>
                <span className="shrink-0 text-[11px] text-[var(--color-mute)]">
                  {[row.season, row.episodeInfo].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-black text-[var(--color-ink)]">Recently updated series</h2>
          <Link href="/hindi-dub/series" className="text-xs text-[var(--color-cyan)] hover:underline">
            All series →
          </Link>
        </div>
        <div className="mt-4">
          <DubTitleGrid items={recentSeries.items} />
        </div>
      </section>

      <div className="mt-8">
        <NativeBannerAd />
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-black text-[var(--color-ink)]">Dubbed movies</h2>
          <Link href="/hindi-dub/movies" className="text-xs text-[var(--color-cyan)] hover:underline">
            All movies →
          </Link>
        </div>
        <div className="mt-4">
          <DubTitleGrid items={recentMovies.items} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink)]">Sources we track</h2>
        <p className="mt-1 text-xs text-[var(--color-mute)]">
          Domain change hone par bhi links kaam karte hain — ZyniVerse har run par working host detect karta hai.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {stats.sources.map((source) => (
            <a
              key={source.id}
              href={source.redirectPath}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-[var(--color-line)] bg-black/20 p-4 transition hover:border-[var(--color-violet)]/60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-ink)]">{source.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    source.status === "ok" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  {source.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-mute)]">{source.description}</p>
              <p className="mt-2 text-[11px] text-[var(--color-mute)]">
                {source.itemCount.toLocaleString("en-IN")} titles · {new URL(source.baseUrl).hostname}
              </p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
