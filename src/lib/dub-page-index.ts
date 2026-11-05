import { INDIAN_DUB_GUIDES, type IndianDubGuide } from "./indian-dub-guides";
import {
  DUBBED_ANIME_STATIC,
  type DubAnimeEntry,
} from "./data/dubbed-static";

/**
 * One index for every page under `/indian-dubs/[slug]`.
 *
 * Two data sources feed this route:
 *   1. INDIAN_DUB_GUIDES — 41 hand-written editorial guides (intro/history/FAQ).
 *   2. DUBBED_ANIME_STATIC — ~105 verified dub entries (platform, studio, year,
 *      episode count, languages) that previously only appeared as cards on
 *      /dubbed and were never indexable pages of their own.
 *
 * Only entries with at least one Indian language dub become pages. Slugs are
 * stable and unique, and a static entry is skipped when a hand-written guide
 * already covers the same title (matched by MAL id first, then by title). That
 * keeps the richer guide as the canonical page instead of shipping a thinner
 * duplicate at a second URL.
 */
export type DubPage =
  | {
      kind: "guide";
      slug: string;
      name: string;
      guide: IndianDubGuide;
    }
  | {
      kind: "entry";
      slug: string;
      name: string;
      entry: DubAnimeEntry;
    };

/** URL-safe slug: accents stripped, apostrophes dropped, runs collapsed. */
export function dubSlugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function languageSuffix(entry: DubAnimeEntry): string {
  if (entry.hasHindi) return "hindi-dub";
  if (entry.hasTamil) return "tamil-dub";
  return "telugu-dub";
}

function build(): DubPage[] {
  const used = new Set<string>();
  const guideMalIds = new Set<number>();
  const guideTitles = new Set<string>();
  const pages: DubPage[] = [];

  for (const guide of INDIAN_DUB_GUIDES) {
    used.add(guide.slug);
    if (typeof guide.malId === "number") guideMalIds.add(guide.malId);
    guideTitles.add(dubSlugify(guide.name));
    pages.push({
      kind: "guide",
      slug: guide.slug,
      name: guide.name,
      guide,
    });
  }

  const seenMalIds = new Set<number>();

  for (const entry of DUBBED_ANIME_STATIC) {
    if (!entry.hasHindi && !entry.hasTamil && !entry.hasTelugu) continue;

    // Duplicate rows inside the static dataset: keep the first (they differ
    // only in a few metadata fields and share a poster/title).
    if (seenMalIds.has(entry.mal_id)) continue;

    // A hand-written guide is strictly richer — let it own the URL.
    if (guideMalIds.has(entry.mal_id)) continue;
    const normalizedTitle = dubSlugify(entry.displayTitle || entry.title);
    if (guideTitles.has(normalizedTitle)) continue;

    seenMalIds.add(entry.mal_id);

    const base = `${normalizedTitle}-${languageSuffix(entry)}`;
    let slug = base;
    if (used.has(slug)) slug = `${base}-${entry.mal_id}`;
    // Extremely unlikely, but keep the guarantee even if two rows normalise to
    // the same title *and* share an id.
    let n = 2;
    while (used.has(slug)) slug = `${base}-${entry.mal_id}-${n++}`;

    used.add(slug);
    pages.push({
      kind: "entry",
      slug,
      name: entry.displayTitle || entry.title,
      entry,
    });
  }

  return pages;
}

export const DUB_PAGES: readonly DubPage[] = build();

export const DUB_PAGE_SLUGS: readonly string[] = DUB_PAGES.map((p) => p.slug);

const bySlug = new Map(DUB_PAGES.map((p) => [p.slug, p] as const));

export function getDubPage(slug: string): DubPage | undefined {
  return bySlug.get(slug);
}

/** MAL id → page slug. Used to link AnimeList detail pages to a dub guide. */
const byMalId = new Map<number, string>();
/** Normalised title → page slug, the fallback when a title has no MAL id. */
const byTitle = new Map<string, string>();

for (const page of DUB_PAGES) {
  if (page.kind === "guide") {
    if (typeof page.guide.malId === "number") byMalId.set(page.guide.malId, page.slug);
    byTitle.set(dubSlugify(page.guide.name), page.slug);
  } else {
    byMalId.set(page.entry.mal_id, page.slug);
    byTitle.set(dubSlugify(page.entry.displayTitle || page.entry.title), page.slug);
  }
}

export function getDubPageSlugForMalId(malId?: number | null): string | undefined {
  if (typeof malId !== "number") return undefined;
  return byMalId.get(malId);
}

export function getDubPageSlugForTitle(title?: string | null): string | undefined {
  if (!title) return undefined;
  return byTitle.get(dubSlugify(title));
}

/** Same-platform pages first, then anything else — keeps related links useful. */
export function getRelatedDubPages(page: DubPage, limit = 4): DubPage[] {
  const platform =
    page.kind === "guide"
      ? page.guide.platforms[0]
      : page.entry.hindiDubPlatform;
  const genre =
    page.kind === "guide" ? page.guide.genres[0] : page.entry.genres[0];

  const score = (other: DubPage): number => {
    const otherPlatform =
      other.kind === "guide"
        ? other.guide.platforms[0]
        : other.entry.hindiDubPlatform;
    const otherGenre =
      other.kind === "guide" ? other.guide.genres[0] : other.entry.genres[0];
    let n = 0;
    if (platform && otherPlatform === platform) n += 2;
    if (genre && otherGenre === genre) n += 1;
    return n;
  };

  return DUB_PAGES.filter((other) => other.slug !== page.slug)
    .map((other) => ({ other, n: score(other) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((r) => r.other);
}
