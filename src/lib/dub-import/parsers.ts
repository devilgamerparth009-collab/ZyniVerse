/**
 * HTML parsers for the two dub sources. Both sites are public WordPress-ish
 * listings; we only read factual metadata (title, type, languages, genres,
 * poster, air time) and always keep a link back to the original page.
 */
import * as cheerio from "cheerio";

export type DubKind = "series" | "movie";

export interface DubItem {
  sourceId: string;
  sourceUrl: string;
  slug: string;
  title: string;
  kind: DubKind;
  posterUrl: string | null;
  languages: string[];
  genres: string[];
  season: string | null;
  episodeInfo: string | null;
  description: string | null;
  year: number | null;
  rating: number | null;
  lastModified: Date | null;
  /** Set when this row's detail page was actually read (enrichment marker). */
  detailFetched?: boolean;
}

export interface DubScheduleRow {
  sourceId: string;
  title: string;
  posterUrl: string | null;
  season: string | null;
  episodeInfo: string | null;
  languages: string[];
  dayLabel: string | null;
  timeLabel: string | null;
  releaseAt: Date | null;
  sourceUrl: string;
}

export interface ListingResult {
  items: DubItem[];
  nextPage: string | null;
  lastPage: number;
}

export const LANGUAGE_SLUGS: Record<string, string> = {
  hindi: "Hindi",
  tamil: "Tamil",
  telugu: "Telugu",
  bengali: "Bengali",
  bangla: "Bengali",
  malayalam: "Malayalam",
  kannada: "Kannada",
  english: "English",
  japanese: "Japanese",
  chinese: "Chinese",
  korean: "Korean",
  marathi: "Marathi",
  urdu: "Urdu",
  gujarati: "Gujarati",
  punjabi: "Punjabi",
  odia: "Odia",
  assamese: "Assamese",
};

/** Canonical order used everywhere so chips never jump around. */
export const LANGUAGE_ORDER = [
  "Hindi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Odia",
  "Assamese",
  "English",
  "Japanese",
  "Chinese",
  "Korean",
];

export function sortLanguages(languages: string[]): string[] {
  const seen = new Set(languages);
  const ordered = LANGUAGE_ORDER.filter((l) => seen.has(l));
  const extra = [...seen].filter((l) => !LANGUAGE_ORDER.includes(l)).sort();
  return [...ordered, ...extra];
}

export function clean(text: string | undefined | null): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

export function slugify(text: string): string {
  return clean(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

const TITLE_CUT =
  /\s+(?:Hindi|Tamil|Telugu|Bengali|Bangla|Malayalam|Kannada|Marathi|Gujarati|Punjabi|Urdu|Odia|Assamese|English|Japanese|Chinese|Korean|Multi(?:\s*Audio)?)\b[\s,(\-–]/i;

const TITLE_TAIL =
  /\s+(?:(?:WEB[- ]?DL|WEB[- ]?Rip|BluRay|Blu[- ]?Ray|HDTV|HDCAM|CR\s+Dub|Crunchyroll\s+Dub|Multi\s+Audio|Dual\s+Audio|Episodes?|Movies?|Series|Download|480p|720p|1080p|2160p)\b[\s\S]*)$/i;

/**
 * Source titles are SEO strings such as
 * `"Jujutsu Kaisen Season 2 Hindi, Tamil, English (Multi Audio) WEB-DL Episodes Download"`.
 * The card UI only needs `"Jujutsu Kaisen Season 2"`, so cut the marketing tail
 * (language list, quality tags, "Download") while keeping the real name.
 */
export function cleanTitle(raw: string): string {
  let title = clean(raw);
  const cut = title.search(TITLE_CUT);
  if (cut > 0) title = title.slice(0, cut);
  title = title.replace(TITLE_TAIL, "").replace(/[\s\-–:|,]+$/, "").trim();
  return title || clean(raw);
}

export function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Known messy variants seen on the source sites → one canonical genre name. */
const GENRE_ALIASES: Record<string, string> = {
  "sci-fi": "Sci-Fi",
  "sci-fi-fantasy": "Sci-Fi",
  "sci-fi-amp-fantasy": "Sci-Fi",
  "sci-fi-and-fantasy": "Sci-Fi",
  "action-amp-adventure": "Action",
  "action-and-adventure": "Action",
  "slice-of-life": "Slice of Life",
  "slice-of-life-amp-fantasy": "Slice of Life",
};

/** Decodes double-encoded HTML entities and folds common spelling variants. */
export function normalizeGenreName(raw: string): string {
  const decoded = cheerio.load(raw).root().text().replace(/\s+/g, " ").trim();
  const key = slugify(decoded);
  return GENRE_ALIASES[key] || titleCase(key) || decoded;
}

function decodeSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `?w=1024&fit=1024,1024` posters are huge; ask the CDN for a card-sized one. */
export function normalizePoster(url: string | undefined | null): string | null {
  const raw = clean(url);
  if (!raw || raw.startsWith("data:")) return null;
  if (raw.includes("i0.wp.com") || raw.includes("i1.wp.com") || raw.includes("i2.wp.com") || raw.includes("i3.wp.com")) {
    return raw
      .replace(/([?&])w=\d+/, "$1w=400")
      .replace(/([?&])fit=\d+,\d+/, "$1fit=400,400")
      .replace(/&amp;/g, "&");
  }
  return raw.replace(/&amp;/g, "&");
}

export function parseYear(text: string): number | null {
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

export function extractSeason(title: string): string | null {
  const m = title.match(/\b(?:season|s)\s*(\d{1,2})\b/i);
  return m ? `Season ${Number(m[1])}` : null;
}

export function extractEpisodeInfo(title: string): string | null {
  const range = title.match(/\bep(?:isode)?s?\.?\s*(\d{1,4})\s*(?:-|–|to)\s*(\d{1,4})\b/i);
  if (range) return `EP ${range[1]}-${range[2]}`;
  const single = title.match(/\bep(?:isode)?s?\.?\s*(\d{1,4})\b/i);
  if (single) return `EP ${single[1]}`;
  return null;
}

function languagesFromText(text: string): string[] {
  const found: string[] = [];
  for (const [slug, label] of Object.entries(LANGUAGE_SLUGS)) {
    if (new RegExp(`\\b${slug}\\b`, "i").test(text)) found.push(label);
  }
  if (/multi[-\s]*audio/i.test(text) && found.length === 0) found.push("Hindi");
  return sortLanguages(found);
}

const NON_GENRE = new Set([
  "series",
  "movie",
  "movies",
  "uncategorized",
  "featured",
  "post",
  "type-post",
  "format-standard",
  "hentry",
  "has-post-thumbnail",
  "status-publish",
]);

function splitCategories(classes: string): { languages: string[]; genres: string[]; kind: DubKind | null } {
  const slugs = classes
    .split(/\s+/)
    .filter((c) => c.startsWith("category-"))
    .map((c) => c.slice("category-".length).toLowerCase());

  const languages: string[] = [];
  const genres: string[] = [];
  let kind: DubKind | null = null;

  for (const slug of slugs) {
    if (LANGUAGE_SLUGS[slug]) {
      languages.push(LANGUAGE_SLUGS[slug]);
      continue;
    }
    if (slug === "series") {
      kind = "series";
      continue;
    }
    if (slug === "movie" || slug === "movies") {
      kind = "movie";
      continue;
    }
    if (NON_GENRE.has(slug) || /^\d+$/.test(slug)) continue;
    genres.push(normalizeGenreName(slug));
  }

  return { languages: sortLanguages(languages), genres: [...new Set(genres)], kind };
}

function meta($: cheerio.CheerioAPI, selector: string): string {
  return clean($(selector).attr("content"));
}

/* ------------------------------------------------------------------ */
/* Anime Dub Hindi                                                     */
/* ------------------------------------------------------------------ */

export function parseAnimeDubHindiListing(html: string, baseUrl: string): ListingResult {
  const $ = cheerio.load(html);
  const items: DubItem[] = [];

  $("article").each((_, el) => {
    const $el = $(el);
    const classes = $el.attr("class") || "";
    const cats = splitCategories(classes);
    const title =
      clean($el.find("h2").first().text()) ||
      clean($el.find("a[rel='bookmark']").first().text()) ||
      clean($el.find("a[aria-label^='Read']").first().attr("aria-label")?.replace(/^Read:\s*/i, ""));
    if (!title) return;
    const displayTitle = cleanTitle(title);

    const href =
      $el.find("a[rel='bookmark']").first().attr("href") ||
      $el.find(".post-thumb a").first().attr("href") ||
      $el.find("h2 a").first().attr("href") ||
      "";
    if (!href.startsWith("http")) return;
    if (/\/(category|author|page|tag)\//.test(href)) return;

    const postId = ($el.attr("id") || "").replace(/^post-/, "");
    const img = $el.find("img").first();
    const poster = normalizePoster(img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src"));
    const published = $el.find("time[datetime]").first().attr("datetime");
    const lastModified = published ? new Date(published) : null;
    const slug = slugify(decodeSlug(href.replace(/\/$/, "").split("/").pop() || title));

    items.push({
      sourceId: postId || slug,
      sourceUrl: href,
      slug,
      title: displayTitle,
      kind: cats.kind ?? (/movie/i.test(title) ? "movie" : "series"),
      posterUrl: poster,
      languages: cats.languages.length ? cats.languages : languagesFromText(title),
      genres: cats.genres,
      season: extractSeason(displayTitle),
      episodeInfo: extractEpisodeInfo(displayTitle),
      description: null,
      year: parseYear(displayTitle),
      rating: null,
      lastModified: lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : null,
    });
  });

  const nextPage = $("link[rel='next']").attr("href") || null;
  const pageNumbers = $(".page-numbers")
    .toArray()
    .map((el) => Number(clean($(el).text())))
    .filter((n) => Number.isFinite(n) && n > 0);

  return { items, nextPage, lastPage: pageNumbers.length ? Math.max(...pageNumbers) : 1 };
}

export function parseAnimeDubHindiPost(html: string, url: string): Partial<DubItem> {
  const $ = cheerio.load(html);
  const classes = `${$("article").first().attr("class") || ""} ${$("body").attr("class") || ""}`;
  const cats = splitCategories(classes);
  const title =
    clean($("h1.entry-title").first().text()) ||
    meta($, "meta[property='og:title']") ||
    clean($("title").text());
  const slug = slugify(decodeSlug(url.replace(/\/$/, "").split("/").pop() || title));
  const published = $("time[datetime]").first().attr("datetime");

  return {
    sourceId: ($("article").first().attr("id") || "").replace(/^post-/, "") || slug,
    sourceUrl: url,
    slug,
    title: cleanTitle(title),
    kind: cats.kind ?? (/movie/i.test(title) ? "movie" : "series"),
    posterUrl: normalizePoster(meta($, "meta[property='og:image']")),
    languages: cats.languages.length ? cats.languages : languagesFromText(title),
    genres: cats.genres,
    season: extractSeason(cleanTitle(title)),
    episodeInfo: extractEpisodeInfo(cleanTitle(title)),
    description: meta($, "meta[name='description']") || null,
    year: parseYear(cleanTitle(title)),
    rating: null,
    lastModified: published && !Number.isNaN(new Date(published).getTime()) ? new Date(published) : null,
  };
}

export function parseAnimeDubHindiSchedule(html: string, baseUrl: string): DubScheduleRow[] {
  const $ = cheerio.load(html);
  const rows: DubScheduleRow[] = [];

  $(".card").each((_, el) => {
    const $el = $(el);
    const title = clean($el.find("h2").first().text());
    if (!title) return;

    const metas = $el
      .find(".meta-box")
      .toArray()
      .map((m) => clean($(m).text()))
      .filter(Boolean);
    const season = metas.find((m) => /season/i.test(m)) ?? extractSeason(title);
    const episodeInfo = metas.find((m) => /\bep\b/i.test(m)) ?? extractEpisodeInfo(title);

    const langs = $el
      .find(".lang span")
      .toArray()
      .map((s) => clean($(s).text()))
      .filter(Boolean)
      .map((l) => LANGUAGE_SLUGS[l.toLowerCase()] ?? titleCase(l.toLowerCase()));

    const releaseRaw = $el.find("[data-release]").first().attr("data-release");
    const releaseDate = releaseRaw ? new Date(releaseRaw) : null;
    const dayLabel = clean($el.find(".date-block").text()) || null;
    const timeLabel = clean($el.find(".time-block").text()) || null;

    rows.push({
      sourceId: slugify(`${title}-${season ?? ""}-${episodeInfo ?? ""}`),
      title,
      posterUrl: normalizePoster($el.find("img").first().attr("src")),
      season: season ?? null,
      episodeInfo: episodeInfo ?? null,
      languages: sortLanguages(langs),
      dayLabel,
      timeLabel,
      releaseAt: releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate : null,
      sourceUrl: `${baseUrl}/schedule.php`,
    });
  });

  return rows;
}

/* ------------------------------------------------------------------ */
/* Desi Dub Anime                                                      */
/* ------------------------------------------------------------------ */

export function parseDesiListing(html: string, baseUrl: string): ListingResult {
  const $ = cheerio.load(html);
  const items: DubItem[] = [];

  $("article.anime-card").each((_, el) => {
    const $el = $(el);
    const link = $el.find("a[href*='/watch/']").first().attr("href") || "";
    const title =
      clean($el.find("[title]").first().attr("title")) ||
      clean($el.find("h3").first().text()) ||
      clean($el.find("h2").first().text());
    if (!title) return;

    const slugFromLink = link.match(/\/watch\/(.+?)-episode-\d+\/?$/i)?.[1] ?? "";
    const slug = slugify(decodeSlug(slugFromLink || title));
    const badges = $el
      .find("span")
      .toArray()
      .map((s) => clean($(s).text()))
      .filter((t) => t && t.length <= 40);

    const year = badges.map(parseYear).find((y): y is number => y !== null) ?? parseYear(title);
    const ratingRaw = badges.find((b) => /^\d(?:\.\d)?$/.test(b));
    const rating = ratingRaw ? Number(ratingRaw) : null;
    const episodeInfo = badges.find((b) => /^\d+\s*ep$/i.test(b))?.replace(/\s*ep$/i, " EP") ?? null;
    const description = clean($el.find("p").first().text()) || null;
    const updatedText = clean($el.text());
    const rel = updatedText.match(/(\d+)\s+(day|hour|week|month)s?\s+ago/i);

    let lastModified: Date | null = null;
    if (rel) {
      const n = Number(rel[1]);
      const unit = rel[2].toLowerCase();
      const ms = unit === "hour" ? 3.6e6 : unit === "day" ? 8.64e7 : unit === "week" ? 6.048e8 : 2.592e9;
      lastModified = new Date(Date.now() - n * ms);
    }

    items.push({
      sourceId: slug,
      sourceUrl: link,
      slug,
      title: cleanTitle(title),
      kind: /movie/i.test(title) ? "movie" : "series",
      posterUrl: normalizePoster($el.find("img").first().attr("src")),
      languages: languagesFromText(title),
      genres: [],
      season: extractSeason(title),
      episodeInfo,
      description,
      year,
      rating: rating !== null && rating > 0 && rating <= 10 ? rating : null,
      lastModified,
    });
  });

  const nextPage = $("link[rel='next']").attr("href") || null;
  const pageNumbers = $("a[href*='/anime/page/']")
    .toArray()
    .map((el) => Number((($(el).attr("href") || "").match(/\/page\/(\d+)/) || [])[1]))
    .filter((n) => Number.isFinite(n) && n > 0);

  return { items, nextPage, lastPage: pageNumbers.length ? Math.max(...pageNumbers) : 1 };
}

export function parseDesiAnimeDetail(html: string, url: string): Partial<DubItem> {
  const $ = cheerio.load(html);
  const slug = slugify(decodeSlug(url.replace(/\/$/, "").split("/").pop() || ""));
  const ldRaw = $("script[type='application/ld+json']").first().text();

  let ld: any = null;
  try {
    ld = ldRaw ? JSON.parse(ldRaw) : null;
  } catch {
    ld = null;
  }

  const tags = $("a[href*='/tag/']")
    .toArray()
    .map((a) => clean($(a).text()).toLowerCase())
    .map((t) => LANGUAGE_SLUGS[t])
    .filter(Boolean) as string[];

  const genresFromLinks = $("a[href*='/genre/']")
    .toArray()
    .map((a) => clean($(a).text()))
    .filter(Boolean);

  const title = clean(ld?.name) || clean($("h1").first().text()).split(/\r?\n/)[0] || titleCase(slug);
  const poster = normalizePoster(ld?.image) || normalizePoster(meta($, "meta[property='og:image']"));
  const description = clean(ld?.description) || meta($, "meta[name='description']") || null;
  const genres: string[] =
    Array.isArray(ld?.genre) && ld.genre.length
      ? (ld.genre as unknown[]).map((g) => clean(String(g)))
      : genresFromLinks;
  const datePublished = ld?.datePublished ? new Date(ld.datePublished) : null;
  const episodeCount = Number(ld?.numberOfEpisodes) || null;

  return {
    sourceId: slug,
    sourceUrl: url,
    slug,
    title: cleanTitle(title),
    kind: ld?.["@type"] === "Movie" ? "movie" : /movie/i.test(title) ? "movie" : "series",
    posterUrl: poster,
    languages: sortLanguages(tags),
    genres: [...new Set(genres.map((g: string) => normalizeGenreName(g)))],
    season: extractSeason(title),
    episodeInfo: episodeCount ? `${episodeCount} EP` : extractEpisodeInfo(title),
    description,
    year: datePublished && !Number.isNaN(datePublished.getTime()) ? datePublished.getFullYear() : parseYear(title),
    rating: Number(ld?.aggregateRating?.ratingValue) || null,
    lastModified: datePublished && !Number.isNaN(datePublished.getTime()) ? datePublished : null,
  };
}

/**
 * Some listing cards use a watch slug that does not match the anime page slug
 * (`/anime/kaijuu-8-gou/` is a 404; the real page is `/anime/kai-8-gwkwltlbnbj/`).
 * The watch page always links to the right anime page, so use its first
 * `/anime/<slug>/` link as the canonical detail URL.
 */
export function extractDesiAnimeUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const href = $("a[href*='/anime/']").first().attr("href");
  if (!href) return null;
  if (href.startsWith("http")) return href;
  return `${baseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
}

/* ------------------------------------------------------------------ */
/* Sitemaps                                                            */
/* ------------------------------------------------------------------ */

export interface SitemapEntry {
  loc: string;
  lastmod: Date | null;
}

export function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const blocks = xml.split(/<url>/).slice(1);
  for (const block of blocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmodRaw = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    const lastmod = lastmodRaw ? new Date(lastmodRaw) : null;
    entries.push({
      loc: loc.replace(/&amp;/g, "&"),
      lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : null,
    });
  }
  return entries;
}

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}
