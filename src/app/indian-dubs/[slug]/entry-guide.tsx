import Link from "next/link";
import { getStreamingSources, type StreamingSource } from "@/lib/streaming";
import {
  getRelatedDubPages,
  type DubPage,
} from "@/lib/dub-page-index";

/**
 * Data-driven page for a title that has no hand-written guide yet.
 *
 * Every sentence here is composed from fields that already exist in
 * `DUBBED_ANIME_STATIC` (platform, studio, start year, episode count,
 * languages, status) — nothing is invented. That is deliberate: expanding the
 * Hindi-dub surface only helps if the new URLs carry real, checkable facts,
 * otherwise Google treats them as thin doorway pages and ignores the whole
 * cluster.
 */
type EntryPage = Extract<DubPage, { kind: "entry" }>;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

const LANG_COLORS: Record<string, string> = {
  Hindi: "bg-orange-500/20 text-orange-300",
  Tamil: "bg-blue-500/20 text-blue-300",
  Telugu: "bg-green-500/20 text-green-300",
  English: "bg-sky-500/20 text-sky-300",
};

const STATUS_LABEL: Record<string, string> = {
  airing: "Still Airing",
  completed: "Complete",
  upcoming: "Coming Soon",
};

function languagesOf(entry: EntryPage["entry"]): string[] {
  const langs: string[] = [];
  if (entry.hasHindi) langs.push("Hindi");
  if (entry.hasTamil) langs.push("Tamil");
  if (entry.hasTelugu) langs.push("Telugu");
  if (entry.hasEnglish) langs.push("English");
  return langs;
}

function fallbackSources(title: string): StreamingSource[] {
  const q = encodeURIComponent(title);
  return [
    {
      name: "Crunchyroll",
      url: `https://www.crunchyroll.com/search?q=${q}`,
      logo: "Crunchyroll",
      region: "India",
      languages: ["Hindi", "English", "Japanese"],
      type: "subscription",
    },
    {
      name: "Netflix",
      url: `https://www.netflix.com/search?q=${q}`,
      logo: "Netflix",
      region: "India",
      languages: ["Hindi", "English", "Japanese"],
      type: "subscription",
    },
    {
      name: "JioHotstar",
      url: `https://www.jiohotstar.com/search?q=${q}`,
      logo: "JioHotstar",
      region: "India",
      languages: ["Hindi", "English"],
      type: "subscription",
    },
    {
      name: "Muse Asia",
      url: `https://www.youtube.com/@MuseIndiaofficial/search?query=${q}`,
      logo: "Muse Asia",
      region: "India",
      languages: ["Hindi", "English"],
      type: "free",
    },
  ];
}

export default function DubEntryGuide({ page }: { page: EntryPage }) {
  const { entry, name, slug } = page;
  const languages = languagesOf(entry);
  const indianLanguages = languages.filter((l) => l !== "English");
  const langList =
    indianLanguages.length > 1
      ? `${indianLanguages.slice(0, -1).join(", ")} and ${indianLanguages.at(-1)}`
      : (indianLanguages[0] ?? "Indian");
  const platform = entry.hindiDubPlatform;
  const total = entry.totalEpisodes;
  const status = entry.status ? STATUS_LABEL[entry.status] : undefined;

  const curated = getStreamingSources(name);
  const sources = curated.length > 0 ? curated : fallbackSources(name);

  const faq: { q: string; a: string }[] = [
    {
      q: `Is ${name} available in ${langList} dub?`,
      a: entry.hasHindi
        ? `Yes. Our dub database lists an official ${langList} dub of ${name}${platform ? ` on ${platform}` : ""}${entry.hindiDubStartYear ? `, starting in ${entry.hindiDubStartYear}` : ""}. Availability can change by region, so confirm the audio track inside the platform player before you start watching.`
        : `There is no Hindi dub listed for ${name}. The Indian-language dub we track is ${langList}${platform ? ` on ${platform}` : ""}.`,
    },
  ];

  if (total) {
    faq.push({
      q: `How many episodes of ${name} are dubbed?`,
      a: `The series has ${total} episodes${entry.seasons ? ` across ${entry.seasons} season${entry.seasons > 1 ? "s" : ""}` : ""}. Exact dubbed-episode counts are updated in batches by the platform, so the number of episodes currently available with a ${indianLanguages[0] ?? "dubbed"} audio track can trail the total.`,
    });
  }

  if (platform) {
    faq.push({
      q: `Where can I watch ${name} in ${indianLanguages[0] ?? "Hindi"}?`,
      a: `${name} is listed with a ${indianLanguages[0] ?? "Hindi"} dub on ${platform}. Switch the audio track to ${indianLanguages[0] ?? "Hindi"} inside the player. You can also check Crunchyroll, Netflix and JioHotstar for current availability in India.`,
    });
  }

  if (entry.hindiDubStartYear) {
    faq.push({
      q: `When did the ${name} dub start?`,
      a: `The dub of ${name} is listed as starting in ${entry.hindiDubStartYear}${entry.hindiDubStudio ? `, produced by ${entry.hindiDubStudio}` : ""}.`,
    });
  }

  if (entry.status) {
    faq.push({
      q: `Is ${name} still airing?`,
      a:
        entry.status === "airing"
          ? `Yes. ${name} is still airing, so new episodes and dub batches are expected to keep arriving. Check the weekly Hindi dub schedule for the latest uploads.`
          : entry.status === "upcoming"
            ? `No. ${name} has not premiered yet, so its dub will follow the original release.`
            : `No. ${name} has finished its run; every released episode is available to stream, with dubs arriving in batches.`,
    });
  }

  const related = getRelatedDubPages(page, 4);
  const url = `${BASE_URL}/indian-dubs/${slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${name} Hindi Dub — Episodes, Platform & Where to Watch`,
      description: `${name} ${langList} dub: ${total ? `${total} episodes, ` : ""}${platform ? `streaming on ${platform}.` : "where to watch in India."}`,
      url,
      image: entry.image,
      inLanguage: "en",
      publisher: { "@type": "Organization", name: "ZyniVerse", url: BASE_URL },
      mainEntityOfPage: url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Indian Dubs",
          item: `${BASE_URL}/indian-dubs`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `${name} Hindi Dub`,
          item: url,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-mute)]">
        <Link href="/" className="hover:text-[var(--color-cyan)]">Home</Link>
        <span className="text-white/20">/</span>
        <Link href="/indian-dubs" className="hover:text-[var(--color-cyan)]">Indian Dubs</Link>
        <span className="text-white/20">/</span>
        <span className="text-[var(--color-mute)]">{name}</span>
      </nav>

      <header className="neon-rgb-border rounded-2xl p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-cyan)]">
              <span>Regional Dub Database</span>
              {platform && (
                <>
                  <span className="text-white/20">•</span>
                  <span>{platform}</span>
                </>
              )}
            </div>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              {name} <span className="text-[var(--color-cyan)]">Hindi Dub</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
              {entry.hasHindi
                ? `Every verified detail we track for the ${name} ${langList} dub — platform, studio, episode count and where to watch in India.`
                : `${name} has no Hindi dub listed; the Indian-language dub we track is ${langList}. Here is where to watch it in India.`}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {languages.map((l) => (
                <span
                  key={l}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${LANG_COLORS[l] || "bg-white/10 text-white"}`}
                >
                  {l} {l === "English" ? "Audio" : "Dub"}
                </span>
              ))}
              {status && (
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-[var(--color-mute)]">
                  {status}
                </span>
              )}
              {entry.score && (
                <span className="glass-score rounded-full px-3 py-1 font-mono text-xs font-bold">
                  ★ {entry.score}
                </span>
              )}
            </div>
          </div>

          {entry.image && (
            <div className="mx-auto w-40 shrink-0 md:mx-0 md:w-44">
              <div className="dub-poster-card overflow-hidden rounded-xl border border-white/10 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.85)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.image}
                  alt={`${name} poster`}
                  className="block aspect-[2/3] w-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {status && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)]">Status</p>
            <p className="mt-1 text-sm font-semibold text-white">{status}</p>
          </div>
        )}
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)]">Episodes</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {total ? total : "Not listed"}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)]">Available On</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {platform || "See platforms below"}
          </p>
        </div>
        {entry.hindiDubStartYear && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)]">Dubbed Since</p>
            <p className="mt-1 text-sm font-semibold text-white">{entry.hindiDubStartYear}</p>
          </div>
        )}
        {entry.hindiDubStudio && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)]">Dubbing Studio</p>
            <p className="mt-1 text-sm font-semibold text-white">{entry.hindiDubStudio}</p>
          </div>
        )}
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)]">Languages</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {languages.map((l) => (
              <span
                key={l}
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${LANG_COLORS[l] || "bg-white/10 text-white"}`}
              >
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-8">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Is {name} available in {langList}?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
            {entry.hasHindi
              ? `Yes — ${name} is listed with an official ${indianLanguages[0] ?? "Hindi"} dub${platform ? ` on ${platform}` : ""}${entry.hindiDubStartYear ? ` since ${entry.hindiDubStartYear}` : ""}. Open the show on the platform and switch the audio track to ${indianLanguages[0] ?? "Hindi"} inside the player.`
              : `No Hindi dub is listed for ${name} in our database. The Indian-language dub we track is ${langList}${platform ? ` on ${platform}` : ""}.`}
          </p>
        </div>

        {total && (
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              How many episodes are dubbed?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
              {name} has {total} episodes{entry.seasons ? ` across ${entry.seasons} season${entry.seasons > 1 ? "s" : ""}` : ""}.
              Dubs are released in batches, so the number of episodes currently
              carrying a {indianLanguages[0] ?? "dubbed"} audio track may be
              lower than the total. We update this page as new batches land.
            </p>
          </div>
        )}

        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Where to watch {name} in India
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {sources.map((source) => (
              <a
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-xl neon-rgb-border bg-[var(--color-surface1)] p-4 transition-all hover:border-[var(--color-cyan)]"
              >
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{source.name}</h3>
                  <p className="text-[10px] text-[var(--color-mute)]">
                    {source.languages.join(", ")} • {source.region}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    source.type === "free"
                      ? "bg-green-500/20 text-green-400"
                      : source.type === "subscription"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {source.type === "free" ? "FREE" : source.type === "subscription" ? "PAID" : "ADS"}
                </span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-mute)]">
            Dub availability changes often and can differ by region. Always
            confirm the audio track on the platform itself before you start
            watching.
          </p>
        </div>

        {entry.synopsis && (
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              About {name}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
              {entry.synopsis}
            </p>
            {entry.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.genres.slice(0, 6).map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-[var(--color-surface2)] px-2.5 py-0.5 text-[10px] text-[var(--color-mute)]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-white">
          Frequently Asked Questions
        </h2>
        <div className="mt-4 space-y-3">
          {faq.map((f, i) => (
            <details key={f.q} className="glass-card group rounded-xl p-4" open={i === 0}>
              <summary className="cursor-pointer list-none font-semibold text-white">
                <span className="mr-2 inline-block text-[var(--color-cyan)] transition-transform group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <p className="mt-3 pl-5 text-sm leading-relaxed text-[var(--color-mute)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-white">
            More {platform || "Indian"} Dubs
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {related.map((other) => (
              <Link
                key={other.slug}
                href={`/indian-dubs/${other.slug}`}
                className="glass-card block rounded-xl p-4 transition-colors hover:bg-white/5"
              >
                <p className="font-semibold text-white">{other.name}</p>
                <p className="mt-1 text-xs text-[var(--color-mute)]">
                  {other.kind === "guide"
                    ? other.guide.tagline
                    : `${other.entry.hindiDubPlatform ?? "Indian dub"}${other.entry.totalEpisodes ? ` • ${other.entry.totalEpisodes} episodes` : ""}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 rounded-xl border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/5 p-5 text-sm text-[var(--color-mute)]">
        Browse the{" "}
        <Link className="text-[var(--color-cyan)] hover:underline" href="/dubbed">
          live dub hub
        </Link>
        , the weekly{" "}
        <Link className="text-[var(--color-cyan)] hover:underline" href="/hindi-dub-schedule">
          Hindi dub schedule
        </Link>
        , or the full{" "}
        <Link className="text-[var(--color-cyan)] hover:underline" href="/indian-dubs">
          Indian dub guides
        </Link>
        .
      </div>
    </div>
  );
}
