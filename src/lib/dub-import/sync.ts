/**
 * Importer / sync engine for the Hindi & regional dub catalogue.
 *
 * Design goals:
 *  - chunkable: every invocation does a bounded amount of work and returns a
 *    `nextQuery` cursor, so it fits inside a 60s serverless function;
 *  - idempotent: rows are upserted on (source, sourceId);
 *  - incremental: sitemap `lastmod` decides which pages to re-read, so a
 *    daily run costs a handful of requests instead of a full crawl;
 *  - domain-proof: all requests go through `resolveSourceBase`.
 */
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  DubKind,
  DubItem,
  ListingResult,
  parseAnimeDubHindiListing,
  parseAnimeDubHindiSchedule,
  parseDesiAnimeDetail,
  parseDesiListing,
  parseSitemap,
  sitemapUrls,
  extractDesiAnimeUrl,
} from "./parsers";
import { DUB_SOURCES, DubSourceId, fetchText, resolveSourceBase } from "./sources";
import { fetchWpCategories, fetchWpPostsPage } from "./wp-api";

export interface SyncOptions {
  mode?: "full" | "incremental";
  /** Max pages / items handled in this invocation. */
  limit?: number;
  cursor?: string | null;
}

export interface SyncResult {
  source: DubSourceId;
  mode: "full" | "incremental";
  fetched: number;
  upserted: number;
  errors: string[];
  /** Query string (no leading "?") that resumes this sync, or null when done. */
  nextQuery: string | null;
  message: string;
}

const MAX_PAGES = 60;
const UPSERT_BATCH = 40;

function toDate(value: Date | null | undefined): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

async function upsertItems(source: DubSourceId, items: DubItem[]): Promise<number> {
  // A listing page can show the same title twice (new episode + season card).
  // Postgres rejects duplicate conflict targets inside one statement, so merge
  // them first, keeping whichever copy carries the richer metadata.
  const unique = new Map<string, DubItem>();
  for (const item of items) {
    const prev = unique.get(item.sourceId);
    unique.set(
      item.sourceId,
      prev
        ? {
            ...prev,
            ...item,
            posterUrl: item.posterUrl ?? prev.posterUrl,
            languages: item.languages.length ? item.languages : prev.languages,
            genres: item.genres.length ? item.genres : prev.genres,
            season: item.season ?? prev.season,
            episodeInfo: item.episodeInfo ?? prev.episodeInfo,
            description: item.description ?? prev.description,
            year: item.year ?? prev.year,
            rating: item.rating ?? prev.rating,
            lastModified: item.lastModified ?? prev.lastModified,
          }
        : item
    );
  }
  const rows = [...unique.values()];

  let count = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const values = batch.map(
      (item) => Prisma.sql`(
        ${randomUUID()}, ${source}, ${item.sourceId}, ${item.sourceUrl}, ${item.slug}, ${item.title},
        ${item.kind}, ${item.posterUrl}, ${item.languages}, ${item.genres}, ${item.season},
        ${item.episodeInfo}, ${item.description}, ${item.year}, ${item.rating},
        ${toDate(item.lastModified)}, ${item.detailFetched ? new Date() : null}, now(), now()
      )`
    );

    // One round trip per batch instead of one per row: the pooler's latency
    // dominates otherwise (a full crawl is ~1000 upserts).
    await prisma.$executeRaw`
      INSERT INTO "DubCatalogTitle"
        ("id", "source", "sourceId", "sourceUrl", "slug", "title", "kind", "posterUrl",
         "languages", "genres", "season", "episodeInfo", "description", "year", "rating",
         "lastModified", "detailFetchedAt", "firstSeenAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("source", "sourceId") DO UPDATE SET
        "sourceUrl" = EXCLUDED."sourceUrl",
        "slug" = EXCLUDED."slug",
        "title" = EXCLUDED."title",
        "kind" = EXCLUDED."kind",
        "posterUrl" = COALESCE(EXCLUDED."posterUrl", "DubCatalogTitle"."posterUrl"),
        "languages" = CASE WHEN cardinality(EXCLUDED."languages") > 0
          THEN EXCLUDED."languages" ELSE "DubCatalogTitle"."languages" END,
        "genres" = CASE WHEN cardinality(EXCLUDED."genres") > 0
          THEN EXCLUDED."genres" ELSE "DubCatalogTitle"."genres" END,
        "season" = COALESCE(EXCLUDED."season", "DubCatalogTitle"."season"),
        "episodeInfo" = COALESCE(EXCLUDED."episodeInfo", "DubCatalogTitle"."episodeInfo"),
        "description" = COALESCE(EXCLUDED."description", "DubCatalogTitle"."description"),
        "year" = COALESCE(EXCLUDED."year", "DubCatalogTitle"."year"),
        "rating" = COALESCE(EXCLUDED."rating", "DubCatalogTitle"."rating"),
        "lastModified" = COALESCE(EXCLUDED."lastModified", "DubCatalogTitle"."lastModified"),
        "detailFetchedAt" = COALESCE(EXCLUDED."detailFetchedAt", "DubCatalogTitle"."detailFetchedAt"),
        "updatedAt" = now()
    `;
    count += batch.length;
  }
  return count;
}

async function markState(
  source: DubSourceId,
  data: { status?: string; lastError?: string | null; lastSyncAt?: Date; itemCount?: number }
): Promise<void> {
  try {
    const baseUrl = await resolveSourceBase(source).catch(() => DUB_SOURCES[source].candidates[0]);
    await prisma.dubSourceState.upsert({
      where: { source },
      create: { source, baseUrl, ...data, lastCheckedAt: new Date() },
      update: { ...data, lastCheckedAt: new Date() },
    });
  } catch {
    // Bookkeeping must never fail a sync.
  }
}

async function refreshItemCount(source: DubSourceId): Promise<number> {
  const count = await prisma.dubCatalogTitle.count({ where: { source } });
  await markState(source, { itemCount: count });
  return count;
}

/* ------------------------------------------------------------------ */
/* Anime Dub Hindi                                                     */
/* ------------------------------------------------------------------ */

/** Number of REST pages handled in one serverless invocation. */
const ADH_API_PAGES = 12;

function adhCursorPage(cursor: string | null | undefined): number {
  const tail = (cursor || "").split(":").pop() || "";
  return Math.max(1, Number(tail) || 1);
}

/**
 * Full import straight from `/wp-json/wp/v2/posts`. Categories are read once
 * per chunk and used to classify every post as language / genre / kind, so no
 * HTML guessing is involved. The HTML listing parser stays as a fallback for
 * hosts that temporarily disable the REST API.
 */
async function syncAnimeDubHindiFull(
  baseUrl: string,
  options: SyncOptions
): Promise<{ fetched: number; upserted: number; errors: string[]; nextQuery: string | null }> {
  const pageBudget = Math.max(1, Math.min(options.limit ?? ADH_API_PAGES, ADH_API_PAGES));
  let page = adhCursorPage(options.cursor);

  let fetched = 0;
  let upserted = 0;
  const errors: string[] = [];
  let pagesDone = 0;
  let categoryMap: Awaited<ReturnType<typeof fetchWpCategories>> | null = null;

  while (pagesDone < pageBudget) {
    if (!categoryMap) {
      try {
        categoryMap = await fetchWpCategories(baseUrl);
      } catch (error) {
        errors.push(`taxonomy: ${(error as Error).message}`);
        break;
      }
    }

    let items: DubItem[];
    let totalPages = page;
    try {
      const result = await fetchWpPostsPage(baseUrl, categoryMap, page);
      items = result.items;
      totalPages = result.totalPages;
    } catch (error) {
      errors.push(`api page ${page}: ${(error as Error).message}`);
      try {
        const listing = parseAnimeDubHindiListing(
          await fetchText(
            page <= 1 ? `${baseUrl}/category/series/` : `${baseUrl}/category/series/page/${page}/`
          ),
          baseUrl
        );
        items = listing.items;
        totalPages = Math.min(listing.lastPage || 1, MAX_PAGES);
      } catch (fallbackError) {
        errors.push(`html fallback page ${page}: ${(fallbackError as Error).message}`);
        break;
      }
    }

    fetched += items.length;
    if (items.length) upserted += await upsertItems("animedubhindi", items);
    pagesDone += 1;

    if (page >= totalPages || items.length === 0) {
      return { fetched, upserted, errors, nextQuery: "source=animedubhindi&mode=full&cursor=schedule" };
    }
    page += 1;
  }

  return { fetched, upserted, errors, nextQuery: `source=animedubhindi&mode=full&cursor=api:${page}` };
}

async function syncAnimeDubHindiSchedule(baseUrl: string): Promise<{ fetched: number; upserted: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const rows = parseAnimeDubHindiSchedule(await fetchText(`${baseUrl}/schedule.php`), baseUrl);

    // The schedule page has no per-show links. Resolve each title against the
    // catalogue so tapping an airing opens the real show page, not the table.
    const keys = rows.map((r) => normalizeTitleKey(r.title).slice(0, 18)).filter(Boolean);
    const matches = keys.length
      ? await prisma.dubCatalogTitle.findMany({
          where: { source: "animedubhindi" },
          select: { title: true, sourceUrl: true },
        })
      : [];
    for (const row of rows) {
      const key = normalizeTitleKey(row.title).slice(0, 18);
      const match = matches.find((m) => normalizeTitleKey(m.title).startsWith(key));
      if (match) row.sourceUrl = match.sourceUrl;
    }

    const ids = rows.map((r) => r.sourceId);
    if (ids.length) {
      await prisma.dubScheduleEntry.deleteMany({
        where: { source: "animedubhindi", sourceId: { notIn: ids } },
      });
    }
    const values = rows.map(
      (row) => Prisma.sql`(
        ${randomUUID()}, ${"animedubhindi"}, ${row.sourceId}, ${row.title}, ${row.posterUrl},
        ${row.season}, ${row.episodeInfo}, ${row.languages}, ${row.dayLabel}, ${row.timeLabel},
        ${toDate(row.releaseAt)}, ${row.sourceUrl}, now()
      )`
    );
    if (values.length) {
      await prisma.$executeRaw`
        INSERT INTO "DubScheduleEntry"
          ("id", "source", "sourceId", "title", "posterUrl", "season", "episodeInfo",
           "languages", "dayLabel", "timeLabel", "releaseAt", "sourceUrl", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("source", "sourceId") DO UPDATE SET
          "title" = EXCLUDED."title",
          "posterUrl" = COALESCE(EXCLUDED."posterUrl", "DubScheduleEntry"."posterUrl"),
          "season" = COALESCE(EXCLUDED."season", "DubScheduleEntry"."season"),
          "episodeInfo" = COALESCE(EXCLUDED."episodeInfo", "DubScheduleEntry"."episodeInfo"),
          "languages" = CASE WHEN cardinality(EXCLUDED."languages") > 0
            THEN EXCLUDED."languages" ELSE "DubScheduleEntry"."languages" END,
          "dayLabel" = COALESCE(EXCLUDED."dayLabel", "DubScheduleEntry"."dayLabel"),
          "timeLabel" = COALESCE(EXCLUDED."timeLabel", "DubScheduleEntry"."timeLabel"),
          "releaseAt" = COALESCE(EXCLUDED."releaseAt", "DubScheduleEntry"."releaseAt"),
          "sourceUrl" = EXCLUDED."sourceUrl",
          "updatedAt" = now()
      `;
    }
    return { fetched: rows.length, upserted: rows.length, errors };
  } catch (error) {
    errors.push(`schedule: ${(error as Error).message}`);
    return { fetched: 0, upserted: 0, errors };
  }
}

async function syncAnimeDubHindiIncremental(
  baseUrl: string,
  options: SyncOptions
): Promise<{ fetched: number; upserted: number; errors: string[]; nextQuery: string | null }> {
  const errors: string[] = [];
  const budget = Math.max(1, Math.min(options.limit ?? ADH_API_PAGES, ADH_API_PAGES));
  const page = adhCursorPage(options.cursor);

  const state = await prisma.dubSourceState.findUnique({ where: { source: "animedubhindi" } });
  // A small overlap avoids missing a post edited while the previous chunk ran.
  const cutoff = state?.lastSyncAt ? new Date(state.lastSyncAt.getTime() - 6 * 3600 * 1000) : null;
  const modifiedAfter = cutoff ? cutoff.toISOString().slice(0, 19) : null;

  let categoryMap: Awaited<ReturnType<typeof fetchWpCategories>>;
  try {
    categoryMap = await fetchWpCategories(baseUrl);
  } catch (error) {
    errors.push(`taxonomy: ${(error as Error).message}`);
    return { fetched: 0, upserted: 0, errors, nextQuery: null };
  }

  const result = await fetchWpPostsPage(baseUrl, categoryMap, page, { modifiedAfter });
  const upserted = result.items.length ? await upsertItems("animedubhindi", result.items) : 0;

  return {
    fetched: result.items.length,
    upserted,
    errors,
    nextQuery:
      page < result.totalPages
        ? `source=animedubhindi&mode=incremental&cursor=${page + 1}`
        : "source=animedubhindi&mode=incremental&cursor=schedule",
  };
}

/* ------------------------------------------------------------------ */
/* Desi Dub Anime                                                      */
/* ------------------------------------------------------------------ */

function normalizeTitleKey(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function desiDetailFor(
  baseUrl: string,
  ref: { slug: string; sourceUrl?: string | null }
): Promise<Partial<DubItem> | null> {
  const animeUrl = `${baseUrl}/anime/${ref.slug}/`;
  try {
    const detail = parseDesiAnimeDetail(await fetchText(animeUrl), animeUrl);
    if (detail.title) return detail;
  } catch {
    // Many cards use a watch slug that is not a valid /anime/ slug; fall back.
  }

  if (!ref.sourceUrl) return null;

  // Stored rows from before the watch-link fix still point at a broken
  // `/anime/<slug>/` URL, so try derived watch URLs as well.
  const watchCandidates = [
    ref.sourceUrl && !/\/anime\//.test(ref.sourceUrl) ? ref.sourceUrl : null,
    `${baseUrl}/watch/${ref.slug}/`,
    `${baseUrl}/watch/${ref.slug}-episode-1/`,
  ].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);

  for (const watchUrl of watchCandidates) {
    try {
      const watchHtml = await fetchText(watchUrl);
      const watchDetail = parseDesiAnimeDetail(watchHtml, watchUrl);

      // The watch page links to the real anime page; only accept it when the
      // title matches, otherwise we would attach another show's metadata.
      const candidate = extractDesiAnimeUrl(watchHtml, baseUrl);
      if (candidate && candidate !== animeUrl) {
        try {
          const animeHtml = await fetchText(candidate);
          const animeDetail = parseDesiAnimeDetail(animeHtml, candidate);
          const watchKey = normalizeTitleKey(watchDetail.title).slice(0, 14);
          if (watchKey && normalizeTitleKey(animeDetail.title).startsWith(watchKey)) {
            return {
              ...animeDetail,
              // Language tags on the watch page are per-episode and authoritative.
              languages: watchDetail.languages?.length ? watchDetail.languages : animeDetail.languages,
              description: animeDetail.description ?? watchDetail.description,
              posterUrl: animeDetail.posterUrl ?? watchDetail.posterUrl,
            };
          }
        } catch {
          // Ignore and use the watch page metadata below.
        }
      }

      if (watchDetail.title) return watchDetail;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function desiListingUrl(baseUrl: string, page: number): string {
  return page <= 1 ? `${baseUrl}/anime/` : `${baseUrl}/anime/page/${page}/`;
}

async function syncDesiFull(
  baseUrl: string,
  options: SyncOptions
): Promise<{ fetched: number; upserted: number; errors: string[]; nextQuery: string | null }> {
  const pageBudget = Math.max(1, Math.min(options.limit ?? 3, 12));
  const detailBudget = 90;
  const errors: string[] = [];
  const [pageRaw] = (options.cursor || "1").split(":").slice(-1);
  let page = Math.max(1, Number(pageRaw) || 1);
  let fetched = 0;
  let upserted = 0;
  let pagesDone = 0;
  let reachedEnd = false;

  while (pagesDone < pageBudget) {
    if (page > MAX_PAGES) {
      reachedEnd = true;
      break;
    }
    let listing: ListingResult;
    try {
      listing = parseDesiListing(await fetchText(desiListingUrl(baseUrl, page)), baseUrl);
    } catch (error) {
      errors.push(`page ${page}: ${(error as Error).message}`);
      pagesDone += 1;
      page += 1;
      continue;
    }
    if (!listing.items.length) {
      reachedEnd = true;
      break;
    }

    fetched += listing.items.length;

    // Existing slugs keep their rich metadata; only new titles trigger a
    // detail fetch, capped per run.
    const existing = await prisma.dubCatalogTitle.findMany({
      where: { source: "desidubanime", sourceId: { in: listing.items.map((i) => i.sourceId) } },
      select: { sourceId: true, languages: true },
    });
    const known = new Map(existing.map((e) => [e.sourceId, e.languages.length > 0]));

    let detailFetches = 0;
    const enriched: DubItem[] = new Array(listing.items.length);
    for (let i = 0; i < listing.items.length; i += 4) {
      const group = listing.items.slice(i, i + 4);
      const resolved = await Promise.all(
        group.map(async (item) => {
          if (known.get(item.sourceId) || detailFetches >= detailBudget) return item;
          detailFetches += 1;
          const detail = await desiDetailFor(baseUrl, {
            slug: item.slug,
            sourceUrl: item.sourceUrl,
          });
          if (!detail) return item;
          return {
            ...item,
            sourceUrl: detail.sourceUrl ?? item.sourceUrl,
            posterUrl: detail.posterUrl ?? item.posterUrl,
            languages: detail.languages?.length ? detail.languages : item.languages,
            genres: detail.genres?.length ? detail.genres : item.genres,
            description: detail.description ?? item.description,
            season: detail.season ?? item.season,
            episodeInfo: detail.episodeInfo ?? item.episodeInfo,
            year: detail.year ?? item.year,
            rating: detail.rating ?? item.rating,
            kind: (detail.kind as DubKind) ?? item.kind,
            detailFetched: true,
          };
        })
      );
      resolved.forEach((item, index) => {
        enriched[i + index] = item;
      });
    }

    upserted += await upsertItems("desidubanime", enriched);
    pagesDone += 1;

    const lastPage = Math.min(listing.lastPage || 1, MAX_PAGES);
    if (page >= lastPage) {
      page = lastPage + 1;
      reachedEnd = true;
      break;
    }
    page += 1;
  }

  return {
    fetched,
    upserted,
    errors,
    nextQuery: reachedEnd ? "source=desidubanime&mode=full&cursor=enrich" : `source=desidubanime&mode=full&cursor=${page}`,
  };
}

async function syncDesiIncremental(
  baseUrl: string,
  options: SyncOptions
): Promise<{ fetched: number; upserted: number; errors: string[]; nextQuery: string | null }> {
  const errors: string[] = [];
  const budget = Math.max(1, Math.min(options.limit ?? 25, 40));

  let sitemaps: string[] = [];
  try {
    const index = await fetchText(`${baseUrl}/sitemap_index.xml`, { accept: "application/xml" });
    sitemaps = sitemapUrls(index).filter((u) => /anime-sitemap\d*\.xml$/.test(u));
  } catch (error) {
    errors.push(`sitemap index: ${(error as Error).message}`);
  }

  const state = await prisma.dubSourceState.findUnique({ where: { source: "desidubanime" } });
  const cutoff = state?.lastSyncAt ? new Date(state.lastSyncAt.getTime() - 6 * 3600 * 1000) : new Date(Date.now() - 14 * 86400 * 1000);

  let entries = (
    await Promise.all(
      sitemaps.map(async (url) => {
        try {
          return parseSitemap(await fetchText(url, { accept: "application/xml" }));
        } catch {
          return [];
        }
      })
    )
  )
    .flat()
    .filter((e) => /\/anime\/[^/]+\/?$/.test(e.loc))
    .filter((e) => (e.lastmod ? e.lastmod >= cutoff : true))
    .sort((a, b) => (b.lastmod?.getTime() ?? 0) - (a.lastmod?.getTime() ?? 0));

  if (!entries.length) {
    // Newest titles may not be in the sitemap yet — fall back to page 1.
    try {
      const listing = parseDesiListing(await fetchText(desiListingUrl(baseUrl, 1)), baseUrl);
      const fresh = listing.items.slice(0, budget);
      const enriched = await Promise.all(
        fresh.map(async (item) => {
          const detail = await desiDetailFor(baseUrl, {
            slug: item.slug,
            sourceUrl: item.sourceUrl,
          });
          return detail
            ? {
                ...item,
                ...detail,
                sourceId: item.sourceId,
                sourceUrl: detail.sourceUrl ?? item.sourceUrl,
                detailFetched: true,
              }
            : item;
        })
      );
      const upserted = await upsertItems("desidubanime", enriched);
      return { fetched: fresh.length, upserted, errors, nextQuery: null };
    } catch (error) {
      errors.push(`page 1: ${(error as Error).message}`);
      return { fetched: 0, upserted: 0, errors, nextQuery: null };
    }
  }

  const start = Math.max(0, Number(options.cursor) || 0);
  const slice = entries.slice(start, start + budget);
  const items: DubItem[] = [];

  for (let i = 0; i < slice.length; i += 4) {
    const chunk = slice.slice(i, i + 4);
    const parsed = await Promise.all(
      chunk.map(async (entry) => {
        const slug = entry.loc.replace(/\/$/, "").split("/").pop() || "";
        const detail = await desiDetailFor(baseUrl, { slug, sourceUrl: entry.loc });
        if (!detail?.title) return null;
        return {
          sourceId: slug,
          sourceUrl: entry.loc,
          slug,
          title: detail.title,
          kind: (detail.kind as DubKind) ?? "series",
          posterUrl: detail.posterUrl ?? null,
          languages: detail.languages ?? [],
          genres: detail.genres ?? [],
          season: detail.season ?? null,
          episodeInfo: detail.episodeInfo ?? null,
          description: detail.description ?? null,
          year: detail.year ?? null,
          rating: detail.rating ?? null,
          lastModified: detail.lastModified ?? entry.lastmod ?? null,
          detailFetched: true,
        } as DubItem;
      })
    );
    for (const item of parsed) if (item) items.push(item);
  }

  const upserted = await upsertItems("desidubanime", items);
  const next = start + budget;
  return {
    fetched: slice.length,
    upserted,
    errors,
    nextQuery: next < entries.length ? `source=desidubanime&mode=incremental&cursor=${next}` : null,
  };
}

/**
 * Backfills language / genre / description for Desi titles that were stored
 * from a listing card before their detail page was read. Rows drop out of the
 * queue as soon as `description` is set, so titles whose detail page has no
 * language tags are not retried forever.
 */
async function enrichDesiMissing(
  baseUrl: string,
  options: SyncOptions
): Promise<{ fetched: number; upserted: number; errors: string[]; nextQuery: string | null }> {
  const errors: string[] = [];
  const budget = Math.max(1, Math.min(options.limit ?? 20, 30));

  const rows = await prisma.dubCatalogTitle.findMany({
    where: { source: "desidubanime", languages: { isEmpty: true }, detailFetchedAt: null },
    orderBy: { updatedAt: "asc" },
    take: budget,
  });

  const items: DubItem[] = [];
  const failedIds: string[] = [];
  for (let i = 0; i < rows.length; i += 4) {
    const group = rows.slice(i, i + 4);
    const parsed = await Promise.all(
      group.map(async (row) => {
        const detail = await desiDetailFor(baseUrl, {
          slug: row.slug,
          sourceUrl: row.sourceUrl,
        });
        if (!detail) {
          failedIds.push(row.id);
          return null;
        }
        return {
          sourceId: row.sourceId,
          sourceUrl: detail.sourceUrl ?? row.sourceUrl,
          slug: row.slug,
          title: detail.title ?? row.title,
          kind: (detail.kind as DubKind) ?? (row.kind as DubKind),
          posterUrl: detail.posterUrl ?? row.posterUrl,
          languages: detail.languages?.length ? detail.languages : row.languages,
          genres: detail.genres?.length ? detail.genres : row.genres,
          season: detail.season ?? row.season,
          episodeInfo: detail.episodeInfo ?? row.episodeInfo,
          description: detail.description ?? row.description,
          year: detail.year ?? row.year,
          rating: detail.rating ?? row.rating,
          lastModified: detail.lastModified ?? row.lastModified,
          detailFetched: true,
        } as DubItem;
      })
    );
    for (const item of parsed) if (item) items.push(item);
  }

  const upserted = await upsertItems("desidubanime", items);

  // Titles whose detail page could not be read at all are marked as attempted
  // so one dead page never blocks the whole queue; a future manual reset can
  // clear `detailFetchedAt` to retry them.
  if (failedIds.length) {
    errors.push(`${failedIds.length} detail page(s) unavailable`);
    try {
      await prisma.dubCatalogTitle.updateMany({
        where: { id: { in: failedIds } },
        data: { detailFetchedAt: new Date() },
      });
    } catch {
      // Non-fatal.
    }
  }

  return {
    fetched: rows.length,
    upserted,
    errors,
    nextQuery:
      rows.length >= budget && upserted > 0
        ? "source=desidubanime&mode=full&cursor=enrich"
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

export async function syncDubSource(source: DubSourceId, options: SyncOptions = {}): Promise<SyncResult> {
  const mode = options.mode ?? "incremental";
  const cursor = options.cursor ?? null;
  const baseUrl = await resolveSourceBase(source);

  let result: { fetched: number; upserted: number; errors: string[]; nextQuery: string | null };

  if (source === "animedubhindi") {
    if (cursor === "schedule") {
      const schedule = await syncAnimeDubHindiSchedule(baseUrl);
      const count = await refreshItemCount(source);
      await markState(source, {
        status: schedule.errors.length ? "error" : "ok",
        lastError: schedule.errors[0] ?? null,
        lastSyncAt: new Date(),
        itemCount: count,
      });
      return {
        source,
        mode,
        fetched: schedule.fetched,
        upserted: schedule.upserted,
        errors: schedule.errors,
        nextQuery: null,
        message: `Schedule refreshed (${schedule.fetched} airings, ${count} titles in catalogue).`,
      };
    }

    result =
      mode === "full"
        ? await syncAnimeDubHindiFull(baseUrl, { ...options, cursor })
        : await syncAnimeDubHindiIncremental(baseUrl, { ...options, cursor });
  } else {
    if (cursor === "enrich") {
      result = await enrichDesiMissing(baseUrl, options);
    } else {
      result =
        mode === "full"
          ? await syncDesiFull(baseUrl, { ...options, cursor })
          : await syncDesiIncremental(baseUrl, { ...options, cursor });
    }
  }

  const done = !result.nextQuery;
  const count = done ? await refreshItemCount(source) : (await prisma.dubCatalogTitle.count({ where: { source } }));
  await markState(source, {
    status: result.errors.length ? "error" : "ok",
    lastError: result.errors[0] ?? null,
    ...(done ? { lastSyncAt: new Date() } : {}),
    itemCount: count,
  });

  return {
    source,
    mode,
    fetched: result.fetched,
    upserted: result.upserted,
    errors: result.errors,
    nextQuery: result.nextQuery,
    message: done
      ? `${DUB_SOURCES[source].name}: ${count} titles in catalogue.`
      : `${DUB_SOURCES[source].name}: imported ${result.upserted} titles, continuing.`,
  };
}

export async function syncAllDubSources(options: SyncOptions = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const source of Object.keys(DUB_SOURCES) as DubSourceId[]) {
    try {
      results.push(await syncDubSource(source, options));
    } catch (error) {
      results.push({
        source,
        mode: options.mode ?? "incremental",
        fetched: 0,
        upserted: 0,
        errors: [(error as Error).message],
        nextQuery: null,
        message: `${DUB_SOURCES[source].name}: sync failed.`,
      });
    }
  }
  return results;
}
