import { getStreamingSources, type StreamingSource } from "@/lib/streaming";
import { getAnimeStreamingPlatforms, getPlatformByName } from "@/lib/platforms";
import { trackClick } from "@/lib/affiliate";
import { AMAZON_TAG } from "@/lib/affiliate-config";
import boxStyles from "./detailBoxes.module.css";

interface WhereToWatchProps {
  streamingLinks: { site: string; url: string }[];
  title?: string;
  /** Controls the heading/note only — every listed platform stays clickable. */
  internalOnly?: boolean;
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  Crunchyroll: "#F47521",
  Netflix: "#E50914",
  "Prime Video": "#00A8E1",
  "Amazon Prime Video": "#00A8E1",
  JioHotstar: "#1A1A2E",
  "Disney+ Hotstar": "#113CC2",
  "Disney+": "#113CC2",
  "Muse Asia": "#FF0000",
  "Sony LIV": "#8B4513",
  "Apple TV": "#555555",
};

const TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  subscription: { label: "SUB", bg: "#3b82f622", text: "#3b82f6" },
  free: { label: "FREE", bg: "#22c55e22", text: "#22c55e" },
  ads: { label: "ADS", bg: "#f9731622", text: "#f97316" },
};

const LANG_STYLES: Record<string, { bg: string; text: string }> = {
  Hindi: { bg: "#ff993322", text: "#ff9933" },
  English: { bg: "#3b82f622", text: "#3b82f6" },
  Japanese: { bg: "#a855f722", text: "#a855f7" },
};

function getAffiliateUrl(source: StreamingSource): string {
  const name = source.name.toLowerCase();
  if (name.includes("crunchyroll")) {
    try {
      const url = new URL(source.url);
      url.searchParams.set("ref", "zyniverse");
      return url.toString();
    } catch {
      return source.url;
    }
  }
  if (name.includes("amazon") || name.includes("prime")) {
    try {
      const url = new URL(source.url);
      url.searchParams.set("tag", AMAZON_TAG);
      return url.toString();
    } catch {
      return source.url;
    }
  }
  return source.url;
}

function StreamingCard({ source, title }: { source: StreamingSource; title?: string }) {
  const color = PLATFORM_COLORS[source.name] || "#888";
  const typeStyle = TYPE_STYLES[source.type] || TYPE_STYLES.subscription;
  const href = getAffiliateUrl(source);
  const lower = source.name.toLowerCase();
  const isAffiliate = lower.includes("crunchyroll") || lower.includes("prime") || lower.includes("amazon");

  return (
    <a
      href={href}
      target="_blank"
      rel={isAffiliate ? "noopener noreferrer sponsored" : "noopener noreferrer"}
      aria-label={`Open ${source.name} for ${title || "this title"}`}
      onClick={() => {
        if (isAffiliate) trackClick(lower.includes("crunchyroll") ? "crunchyroll" : "amazon", source.name);
      }}
      className={`${boxStyles.subCard} group flex w-[200px] shrink-0 flex-col gap-3 transition-all hover:border-[var(--color-cyan)]/40`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {source.name === "Crunchyroll" ? "CR" :
           source.name === "Netflix" ? "N" :
           source.name === "Amazon Prime Video" || source.name === "Prime Video" ? "PV" :
           source.name === "JioHotstar" ? "JH" :
           source.name === "Disney+ Hotstar" || source.name === "Disney+" ? "DH" :
           source.name === "Muse Asia" ? "MA" :
           source.name === "Sony LIV" ? "SL" :
           source.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-[var(--color-ink)] group-hover:text-[var(--color-cyan)] transition-colors">
            {source.name}
          </p>
          <span
            className={`${boxStyles.langChip} mt-0.5 inline-block font-bold uppercase tracking-wider`}
            style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
          >
            {typeStyle.label}
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-mute)] ml-auto shrink-0">
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
      </div>

      {source.languages.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {source.languages.map((lang) => {
            const ls = LANG_STYLES[lang] || { bg: "#88888822", text: "#888888" };
            return (
              <span
                key={lang}
                className={`${boxStyles.langChip} font-bold tracking-wide`}
                style={{ backgroundColor: ls.bg, color: ls.text, border: `1px solid ${ls.bg.replace("22", "44")}` }}
              >
                {lang}
              </span>
            );
          })}
        </div>
      )}
    </a>
  );
}

export default function WhereToWatch({
  streamingLinks,
  title,
  internalOnly = false,
  className = "",
}: WhereToWatchProps) {
  // AniList's streaming links are title-specific and authoritative. Use them first,
  // then fill in India-only platforms from the curated list without duplicating.
  const exactPlatforms = getAnimeStreamingPlatforms(streamingLinks);
  const exactSources: StreamingSource[] = exactPlatforms.map(({ platform, url }) => ({
    name: platform.name,
    url,
    logo: platform.name,
    region: "Global",
    languages: [],
    type: "subscription",
  }));

  const knownPlatformIds = new Set(exactPlatforms.map(({ platform }) => platform.id));
  const curatedSources = (title ? getStreamingSources(title) : []).filter((source) => {
    const platform = getPlatformByName(source.name);
    return !platform || !knownPlatformIds.has(platform.id);
  });

  const sources = [...exactSources, ...curatedSources];
  if (sources.length === 0) return null;

  const heading = internalOnly ? "Streaming platforms" : "Where to Watch";
  const note = internalOnly
    ? "Availability only — open the internal India watch guide for full details."
    : null;

  return (
    <div className={className}>
      <h3 className={`${boxStyles.boxTitle} font-display text-base font-bold mb-1 flex items-center gap-2`}>
        <span className={boxStyles.headingMark} />
        {heading}
      </h3>
      {note && <p className={`${boxStyles.mutedText} mb-4`}>{note}</p>}
      {!note && <div className="mb-2" />}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[var(--color-line)]">
        {sources.map((source, i) => (
          <StreamingCard key={`${source.name}-${i}`} source={source} title={title} />
        ))}
      </div>
    </div>
  );
}
