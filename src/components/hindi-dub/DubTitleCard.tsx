import Link from "next/link";
import type { DubTitleDTO } from "@/lib/dub-import/queries";

const LANG_TINT: Record<string, string> = {
  Hindi: "text-orange-300 border-orange-400/30 bg-orange-400/10",
  Tamil: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  Telugu: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  Bengali: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  Malayalam: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  Kannada: "text-amber-300 border-amber-400/30 bg-amber-400/10",
};

/**
 * Only the public fields are required so the same card can render server-side
 * DTOs and scrubbed catalogue API results.
 */
export type DubTitleCardData = Pick<
  DubTitleDTO,
  "id" | "title" | "kind" | "posterUrl" | "languages" | "rating" | "season" | "episodeInfo"
>;

export function DubTitleCard({
  item,
  size = "md",
}: {
  item: DubTitleCardData;
  size?: "md" | "lg";
}) {
  const featured = size === "lg";
  return (
    <Link
      href={`/search?q=${encodeURIComponent(item.title)}`}
      className="dub-title-card group flex flex-col"
      title={`Search ${item.title} on ZyniVerse`}
    >
      <div
        className={`dub-title-poster relative aspect-[3/4] overflow-hidden border border-[var(--color-line)] bg-[var(--color-panel)] transition duration-500 group-hover:border-[var(--color-violet)]/50 ${
          featured ? "rounded-2xl" : "rounded-xl"
        }`}
      >
        {item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.posterUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-[var(--color-mute)]">
            {item.title}
          </div>
        )}

        <span className="dub-title-kind absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
          {item.kind === "movie" ? "Movie" : "Series"}
        </span>

        {item.rating != null && (
          <span className="dub-title-rating absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur">
            ★ {item.rating.toFixed(1)}
          </span>
        )}

        <div className="dub-title-shade absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2 pt-8">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/60">
            {item.languages[0] ? `${item.languages[0]} dub` : "Dubbed"}
          </span>
        </div>
      </div>

      <h3
        className={`dub-title-name mt-2.5 line-clamp-2 font-semibold leading-snug text-[var(--color-ink)] transition group-hover:text-[var(--color-cyan)] ${
          featured ? "text-base sm:text-lg" : "text-sm"
        }`}
      >
        {item.title}
      </h3>

      <div className="mt-2 flex flex-wrap gap-1">
        {item.languages.slice(0, 3).map((language) => (
          <span
            key={language}
            className={`dub-title-lang rounded border px-1.5 py-0.5 font-medium ${
              featured ? "text-[11px]" : "text-[10px]"
            } ${
              LANG_TINT[language] ?? "border-white/10 bg-white/5 text-[var(--color-mute)]"
            }`}
          >
            {language}
          </span>
        ))}
        {item.languages.length > 3 && (
          <span
            className={`rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[var(--color-mute)] ${
              featured ? "text-[11px]" : "text-[10px]"
            }`}
          >
            +{item.languages.length - 3}
          </span>
        )}
      </div>

      {(item.season || item.episodeInfo) && (
        <p className={`mt-1 text-[var(--color-mute)] ${featured ? "text-xs" : "text-[11px]"}`}>
          {[item.season, item.episodeInfo].filter(Boolean).join(" · ")}
        </p>
      )}
    </Link>
  );
}

export function DubTitleGrid({
  items,
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
  cardSize = "md",
}: {
  items: DubTitleCardData[];
  className?: string;
  cardSize?: "md" | "lg";
}) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-mute)]">
        No titles yet. Check back soon for new additions.
      </p>
    );
  }

  return (
    <div className={className}>
      {items.map((item) => (
        <DubTitleCard key={item.id} item={item} size={cardSize} />
      ))}
    </div>
  );
}
