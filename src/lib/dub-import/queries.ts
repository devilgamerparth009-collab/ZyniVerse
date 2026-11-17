/**
 * Read helpers for the imported dub catalogue.
 *
 * Both the public API routes and the `/hindi-dub` pages read through these
 * functions so paging, filtering and JSON shapes stay identical everywhere.
 * Rows are converted to plain DTOs (dates as ISO strings) because they travel
 * to the client and are cached by the CDN.
 */
import { prisma } from "@/lib/prisma";
import { sortLanguages } from "./parsers";
import { DUB_SOURCES, DubSourceId } from "./sources";

export interface DubTitleDTO {
  id: string;
  source: DubSourceId;
  sourceName: string;
  sourceUrl: string;
  slug: string;
  title: string;
  kind: string;
  posterUrl: string | null;
  languages: string[];
  genres: string[];
  season: string | null;
  episodeInfo: string | null;
  description: string | null;
  year: number | null;
  rating: number | null;
  updatedAt: string;
  lastModified: string | null;
}

export interface DubScheduleDTO {
  id: string;
  source: DubSourceId;
  sourceName: string;
  title: string;
  posterUrl: string | null;
  season: string | null;
  episodeInfo: string | null;
  languages: string[];
  dayLabel: string | null;
  timeLabel: string | null;
  releaseAt: string | null;
  sourceUrl: string;
}

export type DubSort = "recent" | "title" | "rating" | "year";

export interface DubCatalogQuery {
  source?: string | null;
  kind?: string | null;
  language?: string | null;
  genre?: string | null;
  q?: string | null;
  sort?: string | null;
  page?: number;
  limit?: number;
}

const MAX_LIMIT = 60;

function sourceName(source: string): string {
  return DUB_SOURCES[source as DubSourceId]?.name ?? source;
}

function asSource(value: string): DubSourceId {
  return (DUB_SOURCES[value as DubSourceId] ? value : value) as DubSourceId;
}

type TitleRow = {
  id: string;
  source: string;
  sourceUrl: string;
  slug: string;
  title: string;
  kind: string;
  posterUrl: string | null;
  languages: string[];
  genres: string[];
  season: string | null;
  episodeInfo: string | null;
  description: string | null;
  year: number | null;
  rating: number | null;
  updatedAt: Date;
  lastModified: Date | null;
};

function toTitleDTO(row: TitleRow): DubTitleDTO {
  return {
    id: row.id,
    source: asSource(row.source),
    sourceName: sourceName(row.source),
    sourceUrl: row.sourceUrl,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    posterUrl: row.posterUrl,
    languages: row.languages,
    genres: row.genres,
    season: row.season,
    episodeInfo: row.episodeInfo,
    description: row.description,
    year: row.year,
    rating: row.rating,
    updatedAt: row.updatedAt.toISOString(),
    lastModified: row.lastModified ? row.lastModified.toISOString() : null,
  };
}

function orderFor(sort: string | null | undefined) {
  switch (sort) {
    case "title":
      return [{ title: "asc" as const }];
    case "rating":
      return [{ rating: { sort: "desc" as const, nulls: "last" as const } }, { title: "asc" as const }];
    case "year":
      return [{ year: { sort: "desc" as const, nulls: "last" as const } }, { title: "asc" as const }];
    case "recent":
    default:
      return [{ lastModified: { sort: "desc" as const, nulls: "last" as const } }, { updatedAt: "desc" as const }];
  }
}

export function buildTitleWhere(query: DubCatalogQuery) {
  const where: Record<string, unknown> = {};
  if (query.source && DUB_SOURCES[query.source as DubSourceId]) where.source = query.source;
  if (query.kind === "series" || query.kind === "movie") where.kind = query.kind;
  if (query.language) where.languages = { has: query.language };
  if (query.genre) where.genres = { has: query.genre };
  if (query.q) {
    const q = query.q.trim();
    if (q) where.title = { contains: q, mode: "insensitive" };
  }
  return where;
}

export async function getDubCatalog(query: DubCatalogQuery = {}) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.max(1, Math.min(Math.floor(query.limit ?? 24), MAX_LIMIT));
  const where = buildTitleWhere(query);

  const [total, rows] = await Promise.all([
    prisma.dubCatalogTitle.count({ where }),
    prisma.dubCatalogTitle.findMany({
      where,
      orderBy: orderFor(query.sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(toTitleDTO),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getDubTitle(source: string, slug: string): Promise<DubTitleDTO | null> {
  const row = await prisma.dubCatalogTitle.findFirst({
    where: { source, OR: [{ slug }, { sourceId: slug }] },
  });
  return row ? toTitleDTO(row) : null;
}

export async function getDubRelated(title: DubTitleDTO, take = 12): Promise<DubTitleDTO[]> {
  const rows = await prisma.dubCatalogTitle.findMany({
    where: {
      id: { not: title.id },
      ...(title.languages.length ? { languages: { hasSome: title.languages } } : {}),
    },
    orderBy: orderFor("recent"),
    take,
  });
  return rows.map(toTitleDTO);
}

export async function getDubSchedule({ day, language, limit = 200 }: { day?: string | null; language?: string | null; limit?: number } = {}) {
  const where: Record<string, unknown> = {};
  if (day && day !== "All") where.dayLabel = day;
  if (language && language !== "All") where.languages = { has: language };

  const rows = await prisma.dubScheduleEntry.findMany({
    where,
    orderBy: [{ releaseAt: "asc" }, { title: "asc" }],
    take: Math.max(1, Math.min(limit, 400)),
  });

  return rows.map(
    (row): DubScheduleDTO => ({
      id: row.id,
      source: asSource(row.source),
      sourceName: sourceName(row.source),
      title: row.title,
      posterUrl: row.posterUrl,
      season: row.season,
      episodeInfo: row.episodeInfo,
      languages: row.languages,
      dayLabel: row.dayLabel,
      timeLabel: row.timeLabel,
      releaseAt: row.releaseAt ? row.releaseAt.toISOString() : null,
      sourceUrl: row.sourceUrl,
    })
  );
}

export const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function groupScheduleByDay(rows: DubScheduleDTO[]) {
  const extraDays = ["Daily"];
  const order = [...WEEKDAY_ORDER, ...extraDays];
  const groups = new Map<string, DubScheduleDTO[]>();
  for (const day of order) groups.set(day, []);
  const other: DubScheduleDTO[] = [];

  for (const row of rows) {
    const key = row.dayLabel && order.includes(row.dayLabel) ? row.dayLabel : null;
    if (key) groups.get(key)!.push(row);
    else other.push(row);
  }

  return {
    groups: [...groups.entries()]
      .map(([day, items]) => ({ day, items }))
      .filter((group) => group.items.length > 0),
    other,
  };
}

export async function getDubLanguages() {  const rows = await prisma.dubCatalogTitle.findMany({
    select: { languages: true, kind: true, source: true },
  });

  const counts = new Map<string, { total: number; series: number; movies: number }>();
  for (const row of rows) {
    for (const language of row.languages) {
      const entry = counts.get(language) ?? { total: 0, series: 0, movies: 0 };
      entry.total += 1;
      if (row.kind === "movie") entry.movies += 1;
      else entry.series += 1;
      counts.set(language, entry);
    }
  }

  const languages = sortLanguages([...counts.keys()]).map((language) => ({
    language,
    slug: language.toLowerCase(),
    ...(counts.get(language) ?? { total: 0, series: 0, movies: 0 }),
  }));

  return languages;
}

/** Top genres for a kind, ordered by how many titles carry them. */
export async function getDubGenres(kind?: string, limit = 14) {
  const rows = await prisma.dubCatalogTitle.findMany({
    where: kind ? { kind } : {},
    select: { genres: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const genre of row.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

export async function getDubSources() {
  const [states, grouped] = await Promise.all([
    prisma.dubSourceState.findMany(),
    prisma.dubCatalogTitle.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);

  const counts = new Map(grouped.map((g) => [g.source, g._count._all]));

  return Object.values(DUB_SOURCES).map((cfg) => {
    const state = states.find((s) => s.source === cfg.id);
    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      description: cfg.description,
      accent: cfg.accent,
      baseUrl: state?.baseUrl ?? cfg.candidates[0],
      status: state?.status ?? "unknown",
      lastCheckedAt: state?.lastCheckedAt ? state.lastCheckedAt.toISOString() : null,
      lastSyncAt: state?.lastSyncAt ? state.lastSyncAt.toISOString() : null,
      lastError: state?.lastError ?? null,
      itemCount: counts.get(cfg.id) ?? 0,
      redirectPath: `/go/dub/${cfg.id}`,
    };
  });
}

export async function getDubStats() {
  const [total, series, movies, scheduleCount, sources, languages] = await Promise.all([
    prisma.dubCatalogTitle.count(),
    prisma.dubCatalogTitle.count({ where: { kind: "series" } }),
    prisma.dubCatalogTitle.count({ where: { kind: "movie" } }),
    prisma.dubScheduleEntry.count(),
    getDubSources(),
    getDubLanguages(),
  ]);

  return {
    total,
    series,
    movies,
    scheduleCount,
    languages: languages.length,
    sources,
    updatedAt: sources.reduce<string | null>((latest, s) => {
      if (!s.lastSyncAt) return latest;
      if (!latest || s.lastSyncAt > latest) return s.lastSyncAt;
      return latest;
    }, null),
  };
}
