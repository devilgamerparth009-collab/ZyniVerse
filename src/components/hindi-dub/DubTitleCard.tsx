import type { DubTitleDTO } from "@/lib/dub-import/queries";

const LANG_TINT: Record<string, string> = {
  Hindi: "text-orange-300 border-orange-400/30 bg-orange-400/10",
  Tamil: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  Telugu: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  Bengali: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  Malayalam: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  Kannada: "text-amber-300 border-amber-400/30 bg-amber-400/10",
};

export function DubTitleCard({ item }: { item: DubTitleDTO }) {
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col"
      title={`View ${item.title}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
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

        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
          {item.kind === "movie" ? "Movie" : "Series"}
        </span>

        {item.rating != null && (
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur">
            ★ {item.rating.toFixed(1)}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2 pt-8">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/60">
            {item.languages[0] ? `${item.languages[0]} dub` : "Dubbed"}
          </span>
        </div>
      </div>

      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-ink)] transition group-hover:text-[var(--color-cyan)]">
        {item.title}
      </h3>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {item.languages.slice(0, 3).map((language) => (
          <span
            key={language}
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              LANG_TINT[language] ?? "border-white/10 bg-white/5 text-[var(--color-mute)]"
            }`}
          >
            {language}
          </span>
        ))}
        {item.languages.length > 3 && (
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--color-mute)]">
            +{item.languages.length - 3}
          </span>
        )}
      </div>

      {(item.season || item.episodeInfo) && (
        <p className="mt-1 text-[11px] text-[var(--color-mute)]">
          {[item.season, item.episodeInfo].filter(Boolean).join(" · ")}
        </p>
      )}
    </a>
  );
}

export function DubTitleGrid({ items }: { items: DubTitleDTO[] }) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-8 text-center text-sm text-[var(--color-mute)]">
        No titles yet. The dub catalogue will appear here after the next refresh.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <DubTitleCard key={item.id} item={item} />
      ))}
    </div>
  );
}
