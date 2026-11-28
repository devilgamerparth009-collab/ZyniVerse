import Link from "next/link";
import AnimeCard from "./AnimeCard";
import { CardSkeleton } from "./Loader";
import RevealTitle from "./RevealTitle";
import type { Media } from "@/lib/anilist";

type SectionProps = {
  eyebrow?: string;
  title: string;
  viewAllTo?: string;
  loading?: boolean;
  items?: Media[];
  emptyMessage?: string;
  framed?: boolean;
  frameTone?: "upcoming" | "critics";
};

export default function Section({
  eyebrow,
  title,
  viewAllTo,
  loading,
  items,
  emptyMessage,
  framed = false,
  frameTone = "upcoming",
}: SectionProps) {
  const count = items?.length ?? 0;
  const frame = frameTone === "critics" ? "crt" : "upc";
  const fc = (name: string) => `${frame}-${name}`;

  const content = (
    <>
      <div className={framed ? fc("head") : "mb-5 flex items-end justify-between"}>
        <div>
          {eyebrow && (
            <p
              className={
                framed
                  ? fc("eyebrow")
                  : "font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-magenta)]"
              }
            >
              {framed && <span className={fc("eyebrow-dot")} aria-hidden="true" />}
              {eyebrow}
            </p>
          )}
          <RevealTitle
            as="h2"
            text={title}
            className={framed ? fc("title") : "font-display text-2xl font-bold sm:text-3xl"}
          />
          {framed && <span className={fc("title-line")} aria-hidden="true" />}
        </div>

        {viewAllTo && (
          <div className={framed ? fc("head-side") : undefined}>
            {framed && count > 0 && (
              <span className={fc("count")}>
                <strong>{String(count).padStart(2, "0")}</strong>
                <span>{count === 1 ? "title" : "titles"}</span>
              </span>
            )}
            <Link
              href={viewAllTo}
              className={
                framed
                  ? fc("viewall")
                  : "shrink-0 text-sm text-[var(--color-mute)] hover:text-[var(--color-cyan)]"
              }
            >
              View all →
            </Link>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((a) => (
            <AnimeCard key={a.id} anime={a} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-mute)]">{emptyMessage || "Nothing found."}</p>
      )}
    </>
  );

  if (framed) {
    return (
      <section className={`${fc("section")} mx-auto max-w-7xl px-4 py-10 sm:px-6`}>
        <span className={fc("halo")} aria-hidden="true" />
        <span className={fc("beam")} aria-hidden="true" />
        <div className={fc("shell")}>{content}</div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{content}</section>
  );
}
