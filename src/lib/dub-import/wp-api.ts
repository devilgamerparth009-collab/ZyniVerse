/**
 * Direct WordPress REST API ingestion for Anime Dub Hindi.
 *
 * The site exposes a complete, public `wp-json/wp/v2` API. Reading it is both
 * faster and far more reliable than scraping `/category/*` HTML: every post
 * arrives with its canonical title, excerpt, modified date, permalink,
 * featured image and resolved category terms in a single request.
 *
 * We only store factual metadata and always keep `link` as a source deep link;
 * no video is re-hosted or proxied.
 */
import * as cheerio from "cheerio";
import {
  cleanTitle,
  DubItem,
  extractEpisodeInfo,
  extractSeason,
  LANGUAGE_SLUGS,
  normalizePoster,
  parseYear,
  slugify,
  sortLanguages,
} from "./parsers";

export interface WpTerm {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

export interface WpCategoryMap {
  languages: Map<number, string>;
  genres: Map<number, string>;
  kinds: Map<number, "series" | "movie">;
  all: WpTerm[];
}

interface WpPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  link: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  categories?: number[];
  featured_media?: number;
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string; media_details?: { sizes?: Record<string, { source_url?: string }> } }>;
    "wp:term"?: WpTerm[][];
  };
}

const NON_GENRE = new Set(["uncategorized", "featured", "post", "page", "series", "movie", "movies"]);

/** Exactly the genres advertised on the source site's /genres/ page. */
export const ADH_GENRE_NAMES = [
  "Action", "Adventure", "Comedy", "Sci-Fi", "Romance", "Donghua", "Drama", "Ecchi",
  "Fantasy", "Harem", "Horror", "Isekai", "Magic", "Mystery", "Samurai", "School",
  "Shounen", "Slice of Life", "Sports", "Supernatural", "Thriller",
] as const;

const GENRE_BY_SLUG = new Map(
  ADH_GENRE_NAMES.map((name) => [name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name])
);

function stripHtml(value: string | undefined | null): string {
  if (!value) return "";
  return cheerio.load(value).root().text().replace(/\s+/g, " ").trim();
}

/** Maps WordPress category IDs to the language / genre / kind taxonomy we show. */
export function buildWpCategoryMap(terms: WpTerm[]): WpCategoryMap {
  const languages = new Map<number, string>();
  const genres = new Map<number, string>();
  const kinds = new Map<number, "series" | "movie">();

  for (const term of terms) {
    const slug = term.slug.toLowerCase();
    if (LANGUAGE_SLUGS[slug]) {
      languages.set(term.id, LANGUAGE_SLUGS[slug]);
      continue;
    }
    if (slug === "series") {
      kinds.set(term.id, "series");
      continue;
    }
    if (slug === "movie" || slug === "movies") {
      kinds.set(term.id, "movie");
      continue;
    }
    const genre = GENRE_BY_SLUG.get(slug);
    if (!genre || NON_GENRE.has(slug) || /^\d+$/.test(slug)) continue;
    genres.set(term.id, genre);
  }

  return { languages, genres, kinds, all: terms };
}

/** Fetches the full public category taxonomy (one request per sync chunk). */
export async function fetchWpCategories(baseUrl: string): Promise<WpCategoryMap> {
  const terms: WpTerm[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${baseUrl}/wp-json/wp/v2/categories?per_page=100&page=${page}&_fields=id,name,slug,count`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "ZyniVerse/1.8 (dub catalogue sync)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      if (page === 1) throw new Error(`WP categories: ${res.status}`);
      break;
    }
    const chunk = (await res.json()) as WpTerm[];
    terms.push(...chunk);
    if (chunk.length < 100) break;
  }
  return buildWpCategoryMap(terms);
}

export interface WpPostsPage {
  items: DubItem[];
  totalPages: number;
}

/**
 * Reads one page of posts directly from the WordPress REST API and maps them
 * to the same `DubItem` DTO the HTML importer produces.
 */
export async function fetchWpPostsPage(
  baseUrl: string,
  categoryMap: WpCategoryMap,
  page: number,
  options: { modifiedAfter?: string | null; limit?: number } = {}
): Promise<WpPostsPage> {
  const params = new URLSearchParams({
    per_page: String(Math.max(1, Math.min(options.limit ?? 100, 100))),
    page: String(Math.max(1, page)),
    orderby: "modified",
    order: "desc",
    _embed: "1",
  });
  if (options.modifiedAfter) params.set("modified_after", options.modifiedAfter);

  const url = `${baseUrl}/wp-json/wp/v2/posts?${params.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "ZyniVerse/1.8 (dub catalogue sync)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`WP posts page ${page}: ${res.status} ${res.statusText}`);

  const posts = (await res.json()) as WpPost[];
  const totalPages = Number(res.headers.get("X-WP-TotalPages")) || Math.max(1, page);

  const items = posts.map((post) => mapWpPost(post, categoryMap, baseUrl)).filter(Boolean) as DubItem[];
  return { items, totalPages };
}

function termsFor(post: WpPost): WpTerm[] {
  const embedded = post._embedded?.["wp:term"];
  if (Array.isArray(embedded)) return embedded.flat().filter(Boolean);
  return [];
}

function posterFor(post: WpPost): string | null {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  const sizes = media?.media_details?.sizes;
  const url = media?.source_url || sizes?.medium_large?.source_url || sizes?.medium?.source_url;
  return normalizePoster(url);
}

export function mapWpPost(post: WpPost, categoryMap: WpCategoryMap, baseUrl: string): DubItem | null {
  const rawTitle = stripHtml(post.title?.rendered) || post.slug;
  const title = cleanTitle(rawTitle);
  const link = post.link || `${baseUrl}/${post.slug}/`;
  const slug = slugify(post.slug || title);

  const termIds = post.categories?.length ? post.categories : termsFor(post).filter((t) => t.id).map((t) => t.id);
  const languages = sortLanguages(
    termIds.map((id) => categoryMap.languages.get(id)).filter((v): v is string => Boolean(v))
  );
  const genres = [...new Set(termIds.map((id) => categoryMap.genres.get(id)).filter((v): v is string => Boolean(v)))];
  const kind = termIds.map((id) => categoryMap.kinds.get(id)).find(Boolean) ?? (/movie/i.test(rawTitle) ? "movie" : "series");

  const modified = post.modified ? new Date(`${post.modified.replace(" ", "T")}Z`.replace(/([+-]\d{2}:\d{2})Z$/, "$1")) : null;
  const description = stripHtml(post.excerpt?.rendered) || null;

  return {
    sourceId: String(post.id),
    sourceUrl: link,
    slug,
    title,
    kind,
    posterUrl: posterFor(post),
    languages: languages.length ? languages : [],
    genres,
    season: extractSeason(title),
    episodeInfo: extractEpisodeInfo(title),
    description,
    year: parseYear(title) ?? (post.date ? Number(post.date.slice(0, 4)) || null : null),
    rating: null,
    lastModified: modified && !Number.isNaN(modified.getTime()) ? modified : null,
    detailFetched: true,
  };
}

/** Public taxonomy DTO used by the website and the native app. */
export function wpTaxonomyDto(map: WpCategoryMap) {
  return {
    languages: [...map.languages.values()].sort(),
    genres: [...map.genres.values()].sort(),
    kinds: [...new Set(map.kinds.values())],
  };
}
