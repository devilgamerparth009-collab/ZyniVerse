/**
 * Native Discover data layer.
 *
 * Every public catalogue screen reads AniList directly. User-owned areas read
 * the device-local repository instead of calling zyverse.in. Nothing here
 * includes credentials or hidden backend routes.
 */

import {
  directAiringSchedule,
  directCatalogMedia,
  directCharacterDirectory,
  directCompareMedia,
  directGenres,
  directMediaPage,
  directSmartSearch,
  directStaffDirectory,
  directStudioDirectory,
  directSuggestions,
  directTagCollection,
  directTagMedia,
  directTitleLetter,
  directWatchOrder,
} from './anilistDirect';
import {
  getLocalStats,
  listLocalRecords,
  type LocalRecord,
} from './localRepo';
import { cleanText, truncate } from '../utils/helpers';
import type { DiscoverMode } from '../types';

export interface DiscoverItem {
  id: string;
  kind: 'anime' | 'manga' | 'character' | 'staff' | 'studio' | 'genre' | 'tag' | 'letter' | 'local' | 'info';
  title: string;
  subtitle?: string;
  image?: string | null;
  badge?: string;
  score?: number | null;
  meta?: Record<string, any>;
}

export interface DiscoverParams {
  query?: string;
  letter?: string;
  tag?: string;
  id?: number;
}

export interface DiscoverResult {
  mode: DiscoverMode;
  title: string;
  subtitle: string;
  note?: string;
  items: DiscoverItem[];
}

const MODE_TEXT: Partial<Record<DiscoverMode, [string, string, string?]>> = {
  genres: ['Genres', 'Browse by genre', 'Pick a genre to see matching anime.'],
  tags: ['Tags', 'Browse by detailed tags', 'Pick a tag to see matching titles.'],
  'tag-media': ['Tag results', 'Titles for this tag', undefined],
  'a-z': ['A–Z anime', 'Browse alphabetically', 'Pick a letter to see titles that start with it.'],
  characters: ['Characters', 'Popular characters', undefined],
  staff: ['Staff', 'Directors, writers, and production staff', undefined],
  studios: ['Studios', 'Animation and production studios', undefined],
  'voice-actors': ['Voice actors', 'Popular voice actors', 'Indian dub casting is available in Dub Hub.'],
  'watch-order': ['Watch order', 'Suggested viewing order', 'Search a title to see its related entries in order.'],
  semantic: ['Smart search', 'Find anime by description', 'Search by mood, genre, or plot in plain English.'],
  compare: ['Compare anime', 'Side-by-side comparison', 'Enter two titles separated by | or a comma.'],
  manga: ['Manga', 'Trending manga', undefined],
  'manga-releases': ['Manga releases', 'Recently updated manga', undefined],
  'light-novels': ['Light novels', 'Popular light novels', undefined],
  toons: ['Toons', 'Korean webtoons', undefined],
  doujinshi: ['Doujinshi', 'Short Japanese manga', 'Browse the available catalogue.'],
  figures: ['Figures', 'Your figure collection', 'Add figures you own and keep them here.'],
  'live-action': ['Live action', 'Your live-action list', 'Add titles you want to remember.'],
  'voice-lines': ['Voice lines', 'Characters and voice cast', 'Browse cast information for your favourite characters.'],
  guides: ['Guides', 'Your guides', 'Saved on your device.'],
  critiques: ['Critiques', 'Your critiques', 'Saved on your device.'],
  theories: ['Theories', 'Your theories', 'Saved on your device.'],
  wiki: ['Wiki', 'Your wiki notes', 'Saved on your device.'],
  blog: ['Blog', 'Your drafts', 'Saved on your device.'],
  clubs: ['Clubs', 'Your club notes', 'Saved on your device.'],
  posts: ['Posts', 'Your drafts', 'Saved on your device.'],
  stats: ['Stats', 'Watching statistics', 'Based on your saved titles.'],
  timeline: ['Timeline', 'Activity timeline', 'Based on your saved titles.'],
  wrapped: ['Wrapped / Recap', 'Your recap', 'A private recap from your saved titles.'],
  activity: ['Activity', 'Your activity', 'Based on your saved titles.'],
  graph: ['Activity graph', 'Activity overview', 'Based on your saved titles.'],
  backlog: ['Backlog', 'Your backlog', 'Add titles from any detail screen.'],
  saved: ['Saved', 'Saved items', 'Titles you saved are shown here.'],
  tierlist: ['Tier lists', 'Your tier lists', 'Saved on your device.'],
  lists: ['Custom lists', 'Your lists', 'Saved on your device.'],
  'shared-watchlists': ['Shared watchlists', 'Watchlist plans', 'Saved on your device.'],
  'seasonal-tracker': ['Season tracker', 'Seasonal tracking', 'Saved on your device.'],
  watchlist: ['Watchlist', 'Your watchlist', 'Titles you saved are shown here.'],
  tools: ['Tools', 'Anime tools', undefined],
  'binge-calculator': ['Binge calculator', 'Estimate your watch time', 'Based on your saved titles.'],
  'filler-time': ['Filler time', 'Filler guides', 'Open a title from your watchlist to see its guide.'],
  'watch-stats': ['Watch stats', 'Watching statistics', 'Based on your saved titles.'],
  calendar: ['Calendar', 'Upcoming airings', 'See what airs next.'],
  random: ['Random picker', 'Pick something new', 'Discover a random title.'],
  events: ['Events', 'Community events', 'See events on the website.'],
  conventions: ['Conventions', 'Convention notes', 'Saved on your device.'],
  awards: ['Awards', 'Award notes', 'Saved on your device.'],
  challenges: ['Challenges', 'Challenge notes', 'Saved on your device.'],
  contests: ['Contests', 'Contest notes', 'Saved on your device.'],
  rewards: ['Rewards', 'Rewards overview', 'Manage rewards on the website.'],
  premium: ['Premium', 'Premium overview', 'Manage your plan on the website.'],
  merch: ['Merch', 'Merch overview', 'Shop on the website.'],
  orders: ['My orders', 'Order overview', 'Manage orders on the website.'],
  commissions: ['Commissions', 'Commission notes', 'Manage commissions on the website.'],
  info: ['Information', 'About ZyniVerse', undefined],
};

const LOCAL_COLLECTIONS: Partial<Record<DiscoverMode, string>> = {
  guides: 'content:guides',
  critiques: 'content:critiques',
  theories: 'content:theories',
  wiki: 'content:wiki',
  blog: 'content:blog',
  clubs: 'community:clubs',
  posts: 'community:posts',
  figures: 'catalog:figures',
  'live-action': 'catalog:live-action',
  conventions: 'community:conventions',
  awards: 'community:awards',
  challenges: 'community:challenges',
  contests: 'community:contests',
  saved: 'tracking:saved',
  tierlist: 'tracking:tierlist',
  lists: 'tracking:lists',
  'shared-watchlists': 'tracking:shared-watchlists',
  'seasonal-tracker': 'tracking:seasonal',
  watchlist: 'tracking:watchlist',
  backlog: 'tracking:watchlist',
  timeline: 'activity:timeline',
  activity: 'activity:log',
};

export function localCollectionForMode(mode: DiscoverMode): string | null {
  return LOCAL_COLLECTIONS[mode] || null;
}

export function modeMeta(mode: DiscoverMode): { title: string; subtitle: string; note?: string } {
  const config = MODE_TEXT[mode] || ['Discover', 'Browse ZyniVerse'];
  return { title: config[0], subtitle: config[1], note: config[2] };
}

export function modeHasAdd(mode: DiscoverMode): boolean {
  return !!LOCAL_COLLECTIONS[mode] && mode !== 'watchlist' && mode !== 'backlog';
}

function mediaTitle(item: any): string {
  return (
    item?.title?.english ||
    item?.title?.userPreferred ||
    item?.title?.romaji ||
    item?.title?.native ||
    `Media ${item?.id ?? ''}`
  );
}

function mediaItem(item: any, forceKind?: 'anime' | 'manga'): DiscoverItem {
  const year = item?.startDate?.year ? String(item.startDate.year) : '';
  const length = item?.episodes ? `${item.episodes} eps` : item?.chapters ? `${item.chapters} ch` : '';
  const genres = Array.isArray(item?.genres) ? item.genres.slice(0, 2).join(', ') : '';
  return {
    id: String(item.id),
    kind: forceKind || (item?.type === 'MANGA' ? 'manga' : 'anime'),
    title: mediaTitle(item),
    subtitle: [item?.format, year, length, genres].filter(Boolean).join(' • '),
    image: item?.coverImage?.extraLarge || item?.coverImage?.large || item?.coverImage?.medium || null,
    badge: item?.status ? String(item.status).replace(/_/g, ' ') : undefined,
    score: item?.averageScore ? Number(item.averageScore) / 10 : null,
    meta: { id: Number(item.id), format: item?.format, genres: item?.genres || [] },
  };
}

function characterItem(item: any): DiscoverItem {
  const media = (item?.media?.nodes || [])
    .map((node: any) => mediaTitle(node))
    .slice(0, 2)
    .join(', ');
  return {
    id: `character-${item.id}`,
    kind: 'character',
    title: item?.name?.full || item?.name?.native || `Character ${item.id}`,
    subtitle: [media, item?.favourites ? `${item.favourites.toLocaleString()} favourites` : '']
      .filter(Boolean)
      .join(' • '),
    image: item?.image?.large || item?.image?.medium || null,
    meta: { id: Number(item.id), native: item?.name?.native, kind: 'character' },
  };
}

function staffItem(item: any): DiscoverItem {
  const occupations = Array.isArray(item?.primaryOccupations)
    ? item.primaryOccupations.slice(0, 2).join(', ')
    : '';
  return {
    id: `staff-${item.id}`,
    kind: 'staff',
    title: item?.name?.full || item?.name?.native || `Staff ${item.id}`,
    subtitle: [item?.languageV2, occupations, item?.favourites ? `${item.favourites.toLocaleString()} favourites` : '']
      .filter(Boolean)
      .join(' • '),
    image: item?.image?.large || item?.image?.medium || null,
    meta: { id: Number(item.id), kind: 'staff' },
  };
}

function studioItem(item: any): DiscoverItem {
  const works = (item?.media?.nodes || []).map((node: any) => mediaTitle(node)).slice(0, 2).join(', ');
  return {
    id: `studio-${item.id}`,
    kind: 'studio',
    title: item?.name || `Studio ${item.id}`,
    subtitle: [item?.isAnimationStudio ? 'Animation studio' : 'Studio', works]
      .filter(Boolean)
      .join(' • '),
    image: item?.media?.nodes?.[0]?.coverImage?.large || null,
    badge: item?.favourites ? `${item.favourites.toLocaleString()} ♥` : undefined,
    meta: { id: Number(item.id), kind: 'studio' },
  };
}

function localItem(record: LocalRecord): DiscoverItem {
  const data = record.data || {};
  const title = String(data.title || data.name || data.label || 'Untitled entry');
  const body = cleanText(String(data.body || data.note || data.description || data.text || ''));
  return {
    id: record.id,
    kind: 'local',
    title,
    subtitle: body ? truncate(body, 90) : `Saved ${new Date(record.updatedAt).toLocaleDateString()}`,
    badge: 'SAVED',
    meta: { recordId: record.id, collection: record.collection, data },
  };
}

function infoItem(id: string, title: string, subtitle: string, meta: Record<string, any> = {}): DiscoverItem {
  return { id, kind: 'info', title, subtitle, meta };
}

function filterByQuery(items: DiscoverItem[], query?: string): DiscoverItem[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      (item.subtitle || '').toLowerCase().includes(q) ||
      (item.badge || '').toLowerCase().includes(q)
  );
}

async function loadLocalMode(mode: DiscoverMode): Promise<DiscoverResult> {
  const meta = modeMeta(mode);
  const collection = localCollectionForMode(mode);
  const watchStats = mode === 'stats' || mode === 'wrapped' || mode === 'graph' || mode === 'watch-stats';

  if (watchStats) {
    const [stats, watchlist] = await Promise.all([getLocalStats(), listLocalRecords('tracking:watchlist')]);
    const scores = watchlist
      .map((record) => Number(record.data?.score))
      .filter((score) => Number.isFinite(score) && score > 0);
    const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : '--';
    const items = [
      infoItem('profile', 'Profile', stats.owner.scope === 'user' ? 'Signed in' : 'This device'),
      infoItem('entries', 'Saved entries', `${stats.records} items`),
      infoItem('watchlist', 'Watchlist titles', `${watchlist.length} titles`),
      infoItem('average', 'Average score', average),
      infoItem('storage', 'Storage', 'Saved on this device'),
    ];
    return { ...meta, mode, items };
  }

  const records = collection ? await listLocalRecords(collection) : [];
  return {
    ...meta,
    mode,
    items: records.map(localItem),
  };
}

const TOOL_TARGETS: Partial<Record<DiscoverMode, Array<[string, string, DiscoverMode]>>> = {
  tools: [
    ['Binge calculator', 'Estimate watch time from saved titles', 'binge-calculator'],
    ['Filler time', 'Open filler guides', 'filler-time'],
    ['Watch stats', 'Watching statistics', 'watch-stats'],
    ['Calendar', 'Upcoming airings', 'calendar'],
    ['Random picker', 'Pick something new', 'random'],
  ],
  'filler-time': [
    ['Filler guide', 'Pick a watchlist title, then open its guide', 'watchlist'],
    ['Watchlist', 'Titles saved on your device', 'watchlist'],
  ],
  events: [
    ['Conventions', 'Convention notes', 'conventions'],
    ['Awards', 'Award notes', 'awards'],
    ['Challenges', 'Challenge notes', 'challenges'],
    ['Contests', 'Contest notes', 'contests'],
  ],
  premium: [
    ['Rewards', 'Rewards overview', 'rewards'],
    ['Merch', 'Shop on the website', 'merch'],
  ],
  info: [
    ['About', 'About ZyniVerse', 'info'],
    ['Feedback', 'Write feedback', 'blog'],
  ],
};

function loadToolMode(mode: DiscoverMode): DiscoverResult {
  const meta = modeMeta(mode);
  const targets = TOOL_TARGETS[mode] || [];
  const items = targets.map(([title, subtitle, target], index) =>
    infoItem(`${mode}-${index}-${target}`, title, subtitle, { targetMode: target })
  );
  if (items.length === 0) {
    items.push(infoItem(`${mode}-empty`, meta.title, meta.subtitle));
  }
  return { ...meta, mode, items };
}

/** Load the data for one native Discover mode. */
export async function loadDiscover(mode: DiscoverMode, params: DiscoverParams = {}): Promise<DiscoverResult> {
  const meta = modeMeta(mode);
  const query = (params.query || '').trim();

  if (localCollectionForMode(mode) || ['stats', 'wrapped', 'graph', 'watch-stats'].includes(mode)) {
    return filterResult(await loadLocalMode(mode), query);
  }

  switch (mode) {
    case 'genres': {
      const genres = await directGenres();
      return filterResult(
        {
          ...meta,
          mode,
          items: genres.map((genre) =>
            infoItem(`genre-${genre}`, genre, 'Open anime in this genre', { genre })
          ),
        },
        query
      );
    }
    case 'tags': {
      const tags = await directTagCollection();
      return filterResult(
        {
          ...meta,
          mode,
          items: tags.map((tag: any) =>
            infoItem(
              `tag-${tag.id}`,
              tag.name,
              [tag.category, cleanText(tag.description || '').slice(0, 90)].filter(Boolean).join(' • '),
              { tag: tag.name }
            )
          ),
        },
        query
      );
    }
    case 'tag-media': {
      const tag = params.tag || query;
      if (!tag) return { ...meta, mode, items: [], note: 'Choose a tag first.' };
      const media = await directTagMedia(tag, query === tag ? '' : query);
      return { ...meta, subtitle: `Anime tagged “${tag}”`, mode, items: media.map((item) => mediaItem(item)) };
    }
    case 'a-z': {
      const letters = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      if (!params.letter) {
        return {
          ...meta,
          mode,
          items: letters.map((letter) =>
            infoItem(`letter-${letter}`, letter, letter === '#' ? 'Numbers and symbols' : `Titles starting with ${letter}`, {
              letter,
            })
          ),
        };
      }
      const media = await directTitleLetter(params.letter);
      return {
        ...meta,
        mode,
        subtitle: `Titles starting with ${params.letter}`,
        items: media.map((item) => mediaItem(item)),
      };
    }
    case 'characters': {
      const rows = await directCharacterDirectory(query);
      return { ...meta, mode, items: rows.map(characterItem) };
    }
    case 'staff':
    case 'voice-actors': {
      const rows = await directStaffDirectory(query);
      return { ...meta, mode, items: rows.map(staffItem) };
    }
    case 'studios': {
      const rows = await directStudioDirectory(query);
      return { ...meta, mode, items: rows.map(studioItem) };
    }
    case 'voice-lines': {
      const rows = await directCharacterDirectory(query);
      return { ...meta, mode, items: rows.map(characterItem) };
    }
    case 'watch-order': {
      if (!query && !params.id) {
        const page = await directMediaPage({ perPage: 24, sort: 'POPULARITY_DESC' });
        return {
          ...meta,
          mode,
          items: page.media.map((item) => mediaItem(item)),
        };
      }
      let id = params.id;
      if (!id) {
        const suggestions = await directSuggestions(query);
        id = suggestions[0]?.id;
      }
      if (!id) return { ...meta, mode, items: [], note: 'No matching anime found.' };
      const result = await directWatchOrder(id);
      return {
        ...meta,
        mode,
        subtitle: `Relations for ${mediaTitle(result.media)}`,
        items: [
          mediaItem(result.media),
          ...result.entries.map((entry) => ({
            ...mediaItem(entry.item),
            id: `relation-${entry.item.id}-${entry.relation}`,
            badge: entry.relation.replace(/_/g, ' '),
          })),
        ],
      };
    }
    case 'semantic': {
      if (!query) return { ...meta, mode, items: [], note: 'Type at least two characters to search.' };
      const media = await directSmartSearch(query);
      return { ...meta, mode, subtitle: `Results for “${query}”`, items: media.map((item) => mediaItem(item)) };
    }
    case 'compare': {
      const names = query
        .split(/\s*(?:\||,|\svs\.?\s|\bversus\b)\s*/i)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 2);
      if (names.length < 2) {
        return { ...meta, mode, items: [], note: 'Type two titles separated by | or a comma.' };
      }
      const found = await Promise.all(names.map((name) => directSuggestions(name)));
      const ids = found.map((rows) => rows[0]?.id).filter(Boolean) as number[];
      if (ids.length < 2) return { ...meta, mode, items: [], note: 'Could not find both titles.' };
      const media = await directCompareMedia(ids);
      return {
        ...meta,
        mode,
        subtitle: media.map(mediaTitle).join('  vs  '),
        items: media.map((item) => mediaItem(item)),
      };
    }
    case 'manga':
    case 'manga-releases':
    case 'light-novels':
    case 'toons':
    case 'doujinshi': {
      const media = await directCatalogMedia(mode, query);
      return { ...meta, mode, items: media.map((item) => mediaItem(item, 'manga')) };
    }
    case 'calendar': {
      const now = Math.floor(Date.now() / 1000);
      const rows = await directAiringSchedule(now, now + 7 * 24 * 60 * 60);
      const items = rows
        .map((row: any) => {
          const item = mediaItem(row.media);
          const date = new Date(Number(row.airingAt) * 1000);
          return {
            ...item,
            id: `airing-${row.id || row.media?.id}`,
            badge: `EP ${row.episode || '?'}`,
            subtitle: `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          };
        })
        .slice(0, 80);
      return { ...meta, mode, items };
    }
    case 'random': {
      const page = await directMediaPage({ perPage: 50, sort: 'TRENDING_DESC' });
      const shuffled = [...page.media].sort(() => Math.random() - 0.5).slice(0, 20);
      return { ...meta, mode, items: shuffled.map((item) => mediaItem(item)) };
    }
    case 'binge-calculator': {
      const watchlist = await listLocalRecords('tracking:watchlist');
      const items = watchlist.map((record) => {
        const episodes = Number(record.data?.episodes) || Number(record.data?.episodeCount) || 0;
        const minutes = episodes * 24;
        return infoItem(
          `binge-${record.id}`,
          String(record.data?.title || 'Untitled'),
          episodes ? `${episodes} eps ≈ ${Math.round(minutes / 60)}h ${minutes % 60}m` : 'Episode count unavailable',
          { animeId: Number(record.data?.animeId) || undefined }
        );
      });
      return { ...meta, mode, items };
    }
    default:
      return filterResult(loadToolMode(mode), query);
  }
}

function filterResult(result: DiscoverResult, query?: string): DiscoverResult {
  const q = (query || '').trim().toLowerCase();
  if (!q) return result;
  return { ...result, items: filterByQuery(result.items, q) };
}
