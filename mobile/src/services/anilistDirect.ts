/**
 * Public AniList reads, called straight from the phone.
 *
 * There is deliberately no website proxy fallback here: public anime data has
 * a canonical upstream (AniList), so the app talks to it directly. When the
 * device is offline or AniList throttles it, `fetchWithCache` in api.ts serves
 * the last good copy (up to 7 days old) instead of calling zyverse.in.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANILIST_GQL = 'https://graphql.anilist.co';
const DEFAULT_TIMEOUT = 12000;
const DIRECT_CACHE_PREFIX = 'zt_direct_v1_';
const DIRECT_FRESH_MS = 6 * 60 * 60 * 1000;
const DIRECT_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native userPreferred }
  coverImage { extraLarge large medium color }
  bannerImage
  description(asHtml: false)
  type
  format
  status(version: 2)
  episodes
  duration
  chapters
  volumes
  countryOfOrigin
  isLicensed
  source(version: 2)
  genres
  averageScore
  meanScore
  popularity
  trending
  favourites
  tags { id name description category rank isGeneralSpoiler isMediaSpoiler isAdult }
  startDate { year month day }
  endDate { year month day }
  season
  seasonYear
  seasonInt
  studios(isMain: true) { nodes { id name isAnimationStudio } }
  trailer { id site thumbnail }
  siteUrl
  nextAiringEpisode { airingAt episode timeUntilAiring }
  externalLinks { site url type language }
  streamingEpisodes { title url site thumbnail }
`;

/**
 * AniList treats an explicit `null` filter as "no results" for some arguments,
 * so every optional argument must be omitted from the query entirely. This
 * mirrors the website's dynamic GraphQL builder instead of declaring unused
 * variables with null values.
 */
function buildPageQuery(params: {
  page?: number;
  perPage?: number;
  search?: string;
  genre?: string;
  tag?: string;
  sort?: string;
  format?: string;
  status?: string;
  type?: string;
  season?: string;
  seasonYear?: number;
  country?: string;
}): { query: string; variables: Record<string, unknown> } {
  const declarations = ['$page: Int', '$perPage: Int'];
  const arguments_: string[] = [];
  const variables: Record<string, unknown> = {
    page: params.page ?? 1,
    perPage: Math.min(params.perPage ?? 24, 50),
  };
  const add = (name: string, declaration: string, argument: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    declarations.push(declaration);
    arguments_.push(argument);
    variables[name] = value;
  };
  add('search', '$search: String', 'search: $search', params.search);
  add('genre', '$genre: String', 'genre: $genre', params.genre);
  add('tag', '$tag: [String]', 'tag_in: $tag', params.tag ? [params.tag] : undefined);
  add('sort', '$sort: [MediaSort]', 'sort: $sort', [
    params.sort || 'POPULARITY_DESC',
  ]);
  add('format', '$format: MediaFormat', 'format: $format', params.format);
  add('status', '$status: MediaStatus', 'status: $status', params.status);
  add('type', '$type: MediaType', 'type: $type', params.type === 'MANGA' ? 'MANGA' : 'ANIME');
  add('season', '$season: MediaSeason', 'season: $season', params.season);
  add('seasonYear', '$seasonYear: Int', 'seasonYear: $seasonYear', params.seasonYear);
  add('country', '$country: CountryCode', 'countryOfOrigin: $country', params.country);
  const query = `query (${declarations.join(', ')}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage total }
      media(${arguments_.join(', ')}, isAdult: false) { ${MEDIA_FIELDS} }
    }
  }`;
  return { query, variables };
}

async function gql<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const res = await fetch(ANILIST_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const json = await res.json();
    if (json?.errors?.length) throw new Error(json.errors[0]?.message || 'AniList error');
    return json?.data as T;
  } finally {
    clearTimeout(timer);
  }
}

async function cachedDirect<T>(key: string, fetcher: () => Promise<T>, ttlMs = DIRECT_FRESH_MS): Promise<T> {
  const storageKey = `${DIRECT_CACHE_PREFIX}${key}`;
  let cached: T | null = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { t: number; v: T };
      if (Date.now() - parsed.t <= (ttlMs > DIRECT_STALE_MS ? ttlMs : DIRECT_STALE_MS)) {
        cached = parsed.v;
      }
    }
  } catch {
    cached = null;
  }

  const network = (async () => {
    const value = await fetcher();
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify({ t: Date.now(), v: value }));
    } catch {
      // Cache is best-effort; a full store must never break the screen.
    }
    return value;
  })();

  if (cached === null) return network;
  const first = await Promise.race([
    network.then(
      (value) => ({ kind: 'fresh' as const, value }),
      () => ({ kind: 'error' as const })
    ),
    new Promise<{ kind: 'slow' }>((resolve) => setTimeout(() => resolve({ kind: 'slow' }), 600)),
  ]);
  if (first.kind === 'fresh') return first.value;
  if (first.kind === 'error') {
    network.catch(() => {});
    return cached;
  }
  network.catch(() => {});
  return cached;
}

function currentSeason(): { season: string; year: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  return {
    season: month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL',
    year: now.getFullYear(),
  };
}

export async function directMediaPage(params: {
  page?: number;
  perPage?: number;
  search?: string;
  genre?: string;
  tag?: string;
  sort?: string;
  format?: string;
  status?: string;
  type?: string;
  season?: string;
  seasonYear?: number;
  country?: string;
}): Promise<{ pageInfo: { hasNextPage: boolean; total: number }; media: any[] }> {
  const { query, variables } = buildPageQuery(params);
  const data = await gql<{ Page: any }>(query, variables);
  const page = data?.Page;
  if (!page || !Array.isArray(page.media)) throw new Error('AniList returned no page');
  return {
    pageInfo: page.pageInfo || { hasNextPage: false, total: page.media.length },
    media: page.media,
  };
}

const LIST_SORTS: Record<string, string> = {
  '/anilist/trending': 'TRENDING_DESC',
  '/anilist/popular': 'POPULARITY_DESC',
  '/anilist/top-rated': 'SCORE_DESC',
};

const MANGA_TYPE_FILTERS: Record<string, { format?: string; country?: string }> = {
  manga: { country: 'JP' },
  manhwa: { country: 'KR' },
  manhua: { country: 'CN' },
  light_novel: { format: 'NOVEL' },
};

/** Returns null when this path has no direct equivalent (caller uses server). */
export async function directListPath(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<any[] | null> {
  const perPage = Number(params.perPage) || 18;
  if (LIST_SORTS[path]) {
    const page = await directMediaPage({ perPage, sort: LIST_SORTS[path] });
    return page.media;
  }
  if (path === '/anilist/manga') {
    const tab = String(params.tab || 'trending');
    const sort = tab === 'top' ? 'SCORE_DESC' : tab === 'popular' ? 'POPULARITY_DESC' : 'TRENDING_DESC';
    const filter = MANGA_TYPE_FILTERS[String(params.type || '')] || {};
    const page = await directMediaPage({
      page: Number(params.page) || 1,
      perPage,
      sort,
      type: 'MANGA',
      format: filter.format,
      country: filter.country,
    });
    return page.media;
  }
  if (path === '/anilist/upcoming') {
    const page = await directMediaPage({
      page: Number(params.page) || 1,
      perPage,
      sort: 'POPULARITY_DESC',
      status: 'NOT_YET_RELEASED',
    });
    return page.media;
  }
  if (path === '/anilist/seasonal') {
    const current = currentSeason();
    const page = await directMediaPage({
      perPage,
      sort: 'POPULARITY_DESC',
      season: params.season as string || current.season,
      seasonYear: Number(params.year) || current.year,
    });
    return page.media;
  }
  if (path === '/anilist/recommendations') {
    const page = await directMediaPage({
      perPage,
      sort: 'TRENDING_DESC',
      genre: String(params.genre || ''),
    });
    return page.media;
  }
  return null;
}

/** Page-shaped direct equivalent for the paged endpoints used by Browse. */
export async function directPagedPath(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<{ pageInfo: { hasNextPage: boolean; total: number }; media: any[] } | null> {
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 24;
  if (path === '/anilist/search-media') {
    return directMediaPage({
      page,
      perPage,
      search: params.search ? String(params.search) : undefined,
      genre: params.genre ? String(params.genre) : undefined,
      sort: params.sort ? String(params.sort) : 'POPULARITY_DESC',
      format: params.format ? String(params.format) : undefined,
      status: params.status ? String(params.status) : undefined,
      type: params.type === 'MANGA' ? 'MANGA' : 'ANIME',
    });
  }
  if (path === '/anilist/upcoming') {
    return directMediaPage({
      page,
      perPage,
      sort: 'POPULARITY_DESC',
      status: 'NOT_YET_RELEASED',
    });
  }
  if (path === '/anilist/seasonal') {
    const current = currentSeason();
    return directMediaPage({
      page,
      perPage,
      sort: 'POPULARITY_DESC',
      season: params.season ? String(params.season) : current.season,
      seasonYear: Number(params.year) || current.year,
    });
  }
  return null;
}

export async function directSuggestions(query: string) {
  const data = await gql<{ Page: { media: any[] } }>(
    `query ($s: String) {
      Page(page: 1, perPage: 8) {
        media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { romaji english }
          coverImage { large }
          format
          status(version: 2)
          startDate { year }
          episodes
        }
      }
    }`,
    { s: query }
  );
  return (data?.Page?.media || []).map((item) => ({
    id: item.id,
    title: item.title?.english || item.title?.romaji,
    titleRomaji: item.title?.romaji,
    poster: item.coverImage?.large,
    format: item.format,
    status: item.status,
    year: item.startDate?.year,
    episodes: item.episodes,
  }));
}

export async function directGenres(): Promise<string[]> {
  return cachedDirect('genres', async () => {
    const data = await gql<{ GenreCollection: string[] }>(`query { GenreCollection }`, {});
    return Array.isArray(data?.GenreCollection) ? data.GenreCollection : [];
  });
}

export async function directSearch(query: string) {
  const data = await gql<{ Page: { media: any[] } }>(
    `query ($s: String) {
      Page(page: 1, perPage: 20) {
        media(search: $s, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { s: query }
  );
  return data?.Page?.media || [];
}

export async function directBatch(ids: number[]): Promise<any[]> {
  const unique = [...new Set(ids)].slice(0, 50);
  if (unique.length === 0) return [];
  const data = await gql<{ Page: { media: any[] } }>(
    `query ($ids: [Int]) { Page(page: 1, perPage: 50) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`,
    { ids: unique }
  );
  return data?.Page?.media || [];
}

/** "Where to watch" data used by the detail screen, straight from AniList. */
export async function directStreamingData(id: number): Promise<{
  title?: string;
  links: Array<{ site?: string | null; url: string }>;
  episodes: Array<{ title?: string | null; site?: string | null; url: string }>;
}> {
  const data = await gql<{ Media: any }>(
    `query ($id: Int) {
      Media(id: $id) {
        id
        title { romaji english userPreferred }
        externalLinks { site url }
        streamingEpisodes { title site url }
      }
    }`,
    { id }
  );
  const media = data?.Media;
  if (!media) throw new Error('Anime not found');
  return {
    title: media.title?.english || media.title?.romaji || media.title?.userPreferred || undefined,
    links: (media.externalLinks || []).filter((l: any) => !!l?.url),
    episodes: (media.streamingEpisodes || []).filter((e: any) => !!e?.url),
  };
}

/**
 * Cover art lookup for scraped dub-catalog rows that have no AniList id.
 * The catalog title is used as the search term; the closest AniList result
 * supplies a reliable CDN poster instead of a hotlink-blocked WordPress image.
 */
export async function directMediaByTitle(title: string): Promise<any | null> {
  const search = (title || '').trim().slice(0, 120);
  if (!search) return null;
  const data = await gql<{ Page: { media: any[] } }>(
    `query ($search: String) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) {
          id
          title { romaji english native userPreferred }
          coverImage { extraLarge large medium color }
        }
      }
    }`,
    { search }
  );
  const media = data?.Page?.media || [];
  if (media.length === 0) return null;

  const norm = (value?: string | null) =>
    (value || '')
      .replace(
        /\s*\((?:Hindi|Tamil|Telugu|Kannada|Malayalam|Bengali|Marathi|English|Dub(?:bed)?|Movie|Film|TV|Series|Season\s*\d+|S\d+)[^)]*\)/gi,
        ' '
      )
      .replace(/\b(?:hindi|tamil|telugu|kannada|malayalam|bengali|marathi|dubbed|dub|movie|film|tv series|season\s*\d+|s\d+)\b/gi, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const needle = norm(search);
  if (needle.length < 3) return null;

  const candidates = media.map((item: any) => ({
    item,
    titles: [
      item?.title?.english,
      item?.title?.romaji,
      item?.title?.native,
      item?.title?.userPreferred,
    ]
      .map(norm)
      .filter(Boolean),
  }));

  // Never guess from the first AniList result. Dub Hub titles often contain a
  // language/season suffix; a wrong id sends users to a different anime and
  // breaks filler lookup. Only exact or unique, confident matches are used.
  const exact = candidates.find((entry) => entry.titles.includes(needle));
  if (exact) return exact.item;

  const partial = candidates.filter((entry) =>
    entry.titles.some(
      (title) => title.length >= 5 && needle.length >= 5 && (title.includes(needle) || needle.includes(title))
    )
  );
  const unique = Array.from(new Map(partial.map((entry) => [entry.item?.id, entry])).values());
  return unique.length === 1 ? unique[0].item : null;
}

const SCHEDULE_MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native userPreferred }
  coverImage { extraLarge large medium color }
  bannerImage
  description(asHtml: false)
  format
  status(version: 2)
  episodes
  genres
  averageScore
  popularity
  countryOfOrigin
  isAdult
  startDate { year month day }
  nextAiringEpisode { airingAt episode timeUntilAiring }
`;

/**
 * Airing calendar for the app's schedule screen. Mirrors the website query but
 * limits the phone to three pages; the first two requests run in parallel.
 * No website fallback: the caller uses its offline cache when AniList fails.
 */
export async function directAiringSchedule(fromSec: number, toSec: number): Promise<any[]> {
  const HOUR = 3600;
  const from = Math.floor(fromSec / HOUR) * HOUR;
  const to = Math.ceil(toSec / HOUR) * HOUR;
  const query = `query ($from: Int, $to: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        id
        episode
        airingAt
        media { ${SCHEDULE_MEDIA_FIELDS} }
      }
    }
  }`;

  const fetchPage = async (page: number) => {
    const data = await gql<{ Page: { pageInfo?: { hasNextPage?: boolean }; airingSchedules?: any[] } }>(
      query,
      { from, to, page }
    );
    return {
      rows: data?.Page?.airingSchedules || [],
      hasNext: !!data?.Page?.pageInfo?.hasNextPage,
    };
  };

  const first = await fetchPage(1);
  const all = [...first.rows];
  if (first.hasNext) {
    const rest = await Promise.all([fetchPage(2), fetchPage(3)]);
    for (const page of rest) all.push(...page.rows);
  }
  return all
    .filter((entry: any) => !entry?.media?.isAdult)
    .sort((a: any, b: any) => (a?.airingAt || 0) - (b?.airingAt || 0));
}

/**
 * Character lookup used by the tournament creator. This is the same public
 * AniList data the website uses, without the website hop.
 */
export async function directCharacterSearch(
  query: string,
  perPage = 20
): Promise<Array<{ id: number; name: string; nameNative?: string | null; image?: string | null; favourites?: number }>> {
  const data = await gql<{ Page: { characters: any[] } }>(
    `query ($s: String, $p: Int) {
      Page(page: 1, perPage: $p) {
        characters(search: $s, sort: FAVOURITES_DESC) {
          id
          name { full native }
          image { large medium }
          favourites
          siteUrl
        }
      }
    }`,
    { s: query, p: Math.min(Math.max(perPage, 1), 50) }
  );
  return (data?.Page?.characters || []).map((item) => ({
    id: Number(item.id),
    name: item.name?.full || item.name?.native || `Character ${item.id}`,
    nameNative: item.name?.native,
    image: item.image?.large || item.image?.medium || null,
    favourites: item.favourites ?? 0,
  }));
}

/** Bulk image/name refresh for tournament participants stored in the shared DB. */
export async function directCharactersByIds(
  ids: number[]
): Promise<Map<number, { name?: string; image?: string | null; favourites?: number }>> {
  const unique = [...new Set(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))].slice(0, 50);
  const result = new Map<number, { name?: string; image?: string | null; favourites?: number }>();
  if (unique.length === 0) return result;
  const data = await gql<{ Page: { characters: any[] } }>(
    `query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        characters(id_in: $ids) {
          id
          name { full native }
          image { large medium }
          favourites
        }
      }
    }`,
    { ids: unique }
  );
  for (const item of data?.Page?.characters || []) {
    result.set(Number(item.id), {
      name: item.name?.full || item.name?.native || undefined,
      image: item.image?.large || item.image?.medium || null,
      favourites: item.favourites ?? 0,
    });
  }
  return result;
}

export async function directCharacters(mediaId: number, page = 1): Promise<any> {
  const data = await gql<{ Media: any }>(
    `query ($id: Int, $p: Int, $pp: Int) {
      Media(id: $id) {
        id
        title { romaji english native userPreferred }
        coverImage { large medium color }
        popularity
        characters(page: $p, perPage: $pp, sort: ROLE) {
          pageInfo { hasNextPage total }
          edges {
            role
            name
            voiceActors { id name { full } image { medium } languageV2 }
            node { id name { full native } image { large medium } favourites }
          }
        }
      }
    }`,
    { id: mediaId, p: page, pp: 25 }
  );
  const media = data?.Media;
  if (!media) throw new Error('Anime not found');
  return {
    id: media.id,
    title: media.title,
    coverImage: media.coverImage,
    popularity: media.popularity ?? 0,
    pageInfo: media.characters?.pageInfo || { hasNextPage: false, total: 0 },
    edges: media.characters?.edges || [],
  };
}

/* ------------------------------------------------------------------ */
/* Native Discover directories                                         */
/* All of these read public AniList data directly. There is deliberately */
/* no zyverse.in proxy fallback in this file.                          */
/* ------------------------------------------------------------------ */

const DISCOVER_MEDIA_FIELDS = `
  id
  title { romaji english native userPreferred }
  coverImage { extraLarge large medium color }
  type
  format
  status(version: 2)
  episodes
  chapters
  genres
  averageScore
  popularity
  favourites
  startDate { year }
`;

function cacheToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

export async function directTagCollection(): Promise<any[]> {
  return cachedDirect('media_tags', async () => {
    const data = await gql<{ MediaTagCollection: any[] }>(
      `query { MediaTagCollection { id name description category isAdult } }`,
      {}
    );
    return (data?.MediaTagCollection || []).filter((tag: any) => !tag?.isAdult);
  });
}

export async function directCharacterDirectory(search = ''): Promise<any[]> {
  const term = (search || '').trim();
  return cachedDirect(`char_dir_${cacheToken(term) || 'all'}`, async () => {
    const data = await gql<{ Page: { characters: any[] } }>(
      `query ($s: String, $p: Int) {
        Page(page: 1, perPage: $p) {
          characters(search: $s, sort: FAVOURITES_DESC) {
            id
            name { full native alternative }
            image { large medium }
            favourites
            siteUrl
            media(sort: POPULARITY_DESC, perPage: 2) {
              nodes { id title { english romaji } }
            }
          }
        }
      }`,
      { s: term || undefined, p: 50 }
    );
    return data?.Page?.characters || [];
  });
}

export async function directStaffDirectory(search = ''): Promise<any[]> {
  const term = (search || '').trim();
  return cachedDirect(`staff_dir_${cacheToken(term) || 'all'}`, async () => {
    const data = await gql<{ Page: { staff: any[] } }>(
      `query ($s: String, $p: Int) {
        Page(page: 1, perPage: $p) {
          staff(search: $s, sort: FAVOURITES_DESC) {
            id
            name { full native }
            image { large medium }
            favourites
            languageV2
            primaryOccupations
            siteUrl
          }
        }
      }`,
      { s: term || undefined, p: 50 }
    );
    return data?.Page?.staff || [];
  });
}

export async function directStudioDirectory(search = ''): Promise<any[]> {
  const term = (search || '').trim();
  return cachedDirect(`studio_dir_${cacheToken(term) || 'all'}`, async () => {
    const data = await gql<{ Page: { studios: any[] } }>(
      `query ($s: String, $p: Int) {
        Page(page: 1, perPage: $p) {
          studios(search: $s, sort: FAVOURITES_DESC) {
            id
            name
            isAnimationStudio
            favourites
            siteUrl
            media(sort: POPULARITY_DESC, perPage: 3) {
              nodes { id title { english romaji } coverImage { large } }
            }
          }
        }
      }`,
      { s: term || undefined, p: 50 }
    );
    return data?.Page?.studios || [];
  });
}

/** Alphabetical anime discovery. AniList has no prefix filter, so we page and filter. */
export async function directTitleLetter(letter: string): Promise<any[]> {
  const target = (letter || '').trim().toUpperCase().slice(0, 1);
  return cachedDirect(`atoz_${cacheToken(target) || 'all'}`, async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map((page) =>
        gql<{ Page: { media: any[] } }>(
          `query ($p: Int) {
            Page(page: $p, perPage: 50) {
              media(type: ANIME, isAdult: false, sort: TITLE_ROMAJI) { ${DISCOVER_MEDIA_FIELDS} }
            }
          }`,
          { p: page }
        )
      )
    );
    const all = pages.flatMap((data) => data?.Page?.media || []);
    const matches = all.filter((item) => {
      const title = String(item?.title?.romaji || item?.title?.english || item?.title?.userPreferred || '')
        .replace(/^(?:the|a|an)\s+/i, '')
        .trim();
      if (!target || target === '#') return !/^[A-Z]/i.test(title);
      return title.toUpperCase().startsWith(target);
    });
    return matches.slice(0, 60);
  });
}

export async function directTagMedia(tag: string, search = ''): Promise<any[]> {
  const page = await cachedDirect(`tag_media_${cacheToken(tag)}_${cacheToken(search) || 'all'}`, () =>
    directMediaPage({
      perPage: 50,
      sort: 'TRENDING_DESC',
      tag,
      search: search || undefined,
    })
  );
  return page.media;
}

export async function directCatalogMedia(
  kind: 'manga' | 'manga-releases' | 'light-novels' | 'toons' | 'doujinshi' | 'indian-dubs',
  search = ''
): Promise<any[]> {
  const configs: Record<typeof kind, Parameters<typeof directMediaPage>[0]> = {
    manga: { type: 'MANGA', sort: 'TRENDING_DESC', perPage: 50 },
    'manga-releases': { type: 'MANGA', sort: 'UPDATED_AT_DESC', perPage: 50 },
    'light-novels': { type: 'MANGA', format: 'NOVEL', sort: 'TRENDING_DESC', perPage: 50 },
    toons: { type: 'MANGA', country: 'KR', sort: 'TRENDING_DESC', perPage: 50 },
    doujinshi: { type: 'MANGA', country: 'JP', format: 'ONE_SHOT', sort: 'TRENDING_DESC', perPage: 50 },
    'indian-dubs': { type: 'ANIME', sort: 'POPULARITY_DESC', country: 'IN', perPage: 50 },
  };
  const params = { ...configs[kind], search: search || undefined };
  const page = await cachedDirect(`catalog_${kind}_${cacheToken(search) || 'all'}`, () =>
    directMediaPage(params)
  );
  return page.media;
}

export async function directWatchOrder(mediaId: number): Promise<{
  media: any;
  entries: Array<{ relation: string; item: any }>;
}> {
  return cachedDirect(`watch_order_${mediaId}`, async () => {
    const data = await gql<{ Media: any }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { romaji english native userPreferred }
          coverImage { extraLarge large medium color }
          format
          episodes
          startDate { year }
          relations {
            edges {
              relationType
              node {
                id
                type
                format
                title { romaji english native userPreferred }
                coverImage { extraLarge large medium color }
                episodes
                startDate { year }
                averageScore
              }
            }
          }
        }
      }`,
      { id: mediaId }
    );
    const media = data?.Media;
    if (!media) throw new Error('Anime not found');
    const rank: Record<string, number> = {
      PREQUEL: 0,
      SOURCE: 1,
      PARENT: 2,
      SIDE_STORY: 3,
      MAIN_STORY: 4,
      ADAPTATION: 5,
      COMPILATION: 6,
      SEQUEL: 7,
      SPIN_OFF: 8,
      ALTERNATIVE: 9,
      OTHER: 10,
    };
    const entries = (media.relations?.edges || [])
      .filter((edge: any) => edge?.node?.id)
      .map((edge: any) => ({ relation: String(edge.relationType || 'RELATED'), item: edge.node }))
      .sort(
        (a: any, b: any) =>
          (rank[a.relation] ?? 11) - (rank[b.relation] ?? 11) ||
          (a.item?.startDate?.year || 0) - (b.item?.startDate?.year || 0)
      );
    return { media, entries };
  });
}

/** Lightweight native "smart search": AniList results scored on the device. */
export async function directSmartSearch(query: string): Promise<any[]> {
  const term = (query || '').trim();
  if (term.length < 2) return [];
  const media = await directSearch(term);
  const needle = cacheToken(term);
  const score = (item: any) => {
    const titles = [item?.title?.english, item?.title?.romaji, item?.title?.native, item?.title?.userPreferred]
      .map((value) => cacheToken(value || ''))
      .join(' ');
    const tags = (item?.tags || []).map((tag: any) => cacheToken(tag?.name || '')).join(' ');
    const genres = (item?.genres || []).map((value: any) => cacheToken(value || '')).join(' ');
    let value = 0;
    if (titles.includes(needle)) value += 10;
    if (tags.includes(needle)) value += 6;
    if (genres.includes(needle)) value += 5;
    if (cacheToken(item?.description || '').includes(needle)) value += 2;
    return value + Math.min(Number(item?.popularity || 0) / 100000, 3);
  };
  return [...media].sort((a, b) => score(b) - score(a));
}

export async function directCompareMedia(ids: number[]): Promise<any[]> {
  const unique = [...new Set(ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))].slice(0, 2);
  if (unique.length === 0) return [];
  const media = await cachedDirect(`compare_${unique.join('_')}`, () => directBatch(unique));
  const order = new Map(unique.map((id, index) => [id, index]));
  return [...media].sort((a, b) => (order.get(Number(a.id)) ?? 99) - (order.get(Number(b.id)) ?? 99));
}
