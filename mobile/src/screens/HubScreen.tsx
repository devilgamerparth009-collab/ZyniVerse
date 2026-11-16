import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api } from '../services/api';
import { absoluteAvatarUrl, cleanText, timeAgo } from '../utils/helpers';

/**
 * Native replacement for the old "More from ZyniVerse" WebView tiles.
 *
 * Every hub fetches the same JSON API the website uses and renders real cards
 * with the app's own typography — no embedded browser. Hubs that only expose a
 * public page (e.g. tools) fall back to an external browser link, never an
 * in-app WebView.
 */

interface HubConfig {
  endpoint: string;
  itemsKey: string;
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  /** Field used to open an external page when there is no native screen. */
  hrefBase?: string;
  hrefField?: string;
}

const HUBS: Record<string, HubConfig> = {
  community: { endpoint: '/feed', itemsKey: 'items', emoji: '🌐', title: 'Community', subtitle: 'Latest from every corner of ZyniVerse', accent: '#a78bfa' },
  clubs: { endpoint: '/clubs', itemsKey: 'clubs', emoji: '🏛️', title: 'Clubs', subtitle: 'Find your people', accent: '#f59e0b', hrefBase: '/clubs/', hrefField: 'slug' },
  moments: { endpoint: '/moments', itemsKey: 'moments', emoji: '✨', title: 'Moments', subtitle: 'Scenes worth framing', accent: '#eab308' },
  clips: { endpoint: '/clips', itemsKey: 'clips', emoji: '✂️', title: 'Clips', subtitle: 'Best moments, shared', accent: '#8b5cf6' },
  memes: { endpoint: '/memes', itemsKey: 'items', emoji: '😂', title: 'Memes', subtitle: 'Certified shitposting', accent: '#facc15' },
  fanart: { endpoint: '/fanart', itemsKey: 'items', emoji: '🎨', title: 'Fan Art', subtitle: 'Drawn by the community', accent: '#fb7185' },
  cosplay: { endpoint: '/cosplay', itemsKey: 'cosplays', emoji: '🎭', title: 'Cosplay', subtitle: 'Real-life anime energy', accent: '#d946ef' },
  blog: { endpoint: '/blog', itemsKey: 'posts', emoji: '✍️', title: 'Blog', subtitle: 'Essays & editorials', accent: '#0ea5e9', hrefBase: '/blog/', hrefField: 'slug' },
  wiki: { endpoint: '/wiki', itemsKey: 'pages', emoji: '📜', title: 'Wiki', subtitle: 'The anime encyclopedia', accent: '#84cc16', hrefBase: '/wiki/', hrefField: 'slug' },
  achievements: { endpoint: '/achievements', itemsKey: 'achievements', emoji: '🏅', title: 'Achievements', subtitle: 'Badges you can earn', accent: '#facc15' },
  challenges: { endpoint: '/challenges', itemsKey: 'challenges', emoji: '🔥', title: 'Challenges', subtitle: 'Community goals', accent: '#ef4444' },
  tierlist: { endpoint: '/tierlist', itemsKey: 'tierLists', emoji: '🏆', title: 'Tier Lists', subtitle: 'Rank everything', accent: '#eab308' },
  merch: { endpoint: '/merch', itemsKey: 'products', emoji: '🛍️', title: 'Merch', subtitle: 'Official & fan-made', accent: '#34d399' },
  watchlist: { endpoint: '/watchlist', itemsKey: 'items', emoji: '📌', title: 'Watchlist', subtitle: 'Saved for later', accent: '#f43f5e' },
  backlog: { endpoint: '/backlog', itemsKey: 'cards', emoji: '🗂️', title: 'Backlog', subtitle: 'Your queue', accent: '#38bdf8' },
  characters: { endpoint: '/characters', itemsKey: 'characters', emoji: '🎭', title: 'Characters', subtitle: 'Fan favourites', accent: '#fb923c' },
  'voice-actors': { endpoint: '/voice-actors', itemsKey: 'actors', emoji: '🎤', title: 'Voice Actors', subtitle: 'The voices behind them', accent: '#fbbf24' },
  contests: { endpoint: '/contests', itemsKey: 'contests', emoji: '🥇', title: 'Contests', subtitle: 'Compete & win', accent: '#f59e0b' },
  'watch-order': { endpoint: '/watch-order', itemsKey: 'orders', emoji: '🧭', title: 'Watch Order', subtitle: 'How to watch any series', accent: '#10b981' },
  'seasonal-tracker': { endpoint: '/seasonal-tracker', itemsKey: 'items', emoji: '📊', title: 'Season Tracker', subtitle: 'Keep up with airing shows', accent: '#a855f7' },
  'manga-releases': { endpoint: '/manga-releases', itemsKey: 'items', emoji: '📖', title: 'Manga Releases', subtitle: 'New chapters this week', accent: '#fb7185' },
  'light-novels': { endpoint: '/light-novels', itemsKey: 'items', emoji: '📕', title: 'Light Novels', subtitle: 'Read the source', accent: '#e879f9' },
  bingo: { endpoint: '/bingo', itemsKey: 'cards', emoji: '🎯', title: 'Anime Bingo', subtitle: 'Play along', accent: '#f472b6' },
  premium: { endpoint: '/premium', itemsKey: 'plans', emoji: '💎', title: 'Premium', subtitle: 'Support ZyniVerse', accent: '#60a5fa' },
};

interface CardModel {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  image?: string;
  badge?: string;
  meta?: string;
  href?: string;
  /** Native screen to open instead of a browser URL. */
  screen?: string;
  params?: Record<string, any>;
}

/** Native-only sections that have no JSON endpoint but do have app screens. */
const STATIC_CARDS: Record<string, CardModel[]> = {
  tools: [
    { id: 'watch-order', title: 'Watch Order', subtitle: 'How to watch any series', meta: 'Native', screen: 'Hub', params: { kind: 'watch-order', title: 'Watch Order' } },
    { id: 'tracker', title: 'Season Tracker', subtitle: 'Keep up with airing shows', meta: 'Native', screen: 'Hub', params: { kind: 'seasonal-tracker', title: 'Season Tracker' } },
    { id: 'tierlist', title: 'Tier List', subtitle: 'Rank everything', meta: 'Native', screen: 'Hub', params: { kind: 'tierlist', title: 'Tier Lists' } },
    { id: 'tv', title: 'TV & Streaming', subtitle: 'Live EPG guide', meta: 'Native', screen: 'TVGuide' },
    { id: 'random', title: 'Surprise Me', subtitle: 'Jump to a random anime', meta: 'Native', screen: 'Hub', params: { kind: 'random', title: 'Surprise Me' } },
  ],
  premium: [
    { id: 'premium-info', title: 'ZyniVerse Premium', subtitle: 'Ad-free browsing, profile glow, early access', body: 'Premium is managed on zyverse.in. Your subscription applies to this app automatically.', meta: 'Manage on website', href: 'https://zyverse.in/premium' },
  ],
};

function toCard(kind: string, raw: any): CardModel {
  const user = raw?.user || raw?.author || raw?.editor || raw?.owner;
  const name = user?.username ? `@${user.username}` : undefined;
  const fallback = `${kind}-${raw?.id || Math.random().toString(36).slice(2)}`;
  const base = (title?: string, subtitle?: string, image?: string): CardModel => ({
    id: String(raw?.id || raw?.slug || fallback),
    title: cleanText(title) || 'Untitled',
    subtitle,
    image: image ? absoluteAvatarUrl(image) : undefined,
  });

  switch (kind) {
    case 'clubs':
      return {
        ...base(raw?.name, `${raw?.memberCount || 0} members · ${raw?.category || 'Club'}`, raw?.coverImage || raw?.icon),
        body: cleanText(raw?.description),
        badge: raw?.isPrivate ? 'PRIVATE' : 'OPEN',
        meta: name,
        href: raw?.slug ? `https://zyverse.in/clubs/${raw.slug}` : undefined,
      };
    case 'moments':
      return {
        ...base(raw?.animeTitle || 'Moment', `${raw?.character || ''}${raw?.episode ? ` · Ep ${raw.episode}` : ''}`, raw?.animeCover),
        body: raw?.quote ? `“${cleanText(raw.quote)}”` : undefined,
        meta: `❤️ ${raw?.likesCount || 0} · 👁️ ${raw?.viewsCount || 0}`,
      };
    case 'clips':
      return {
        ...base(raw?.title || raw?.mediaTitle, name, raw?.imageUrl),
        body: cleanText(raw?.description),
        meta: `❤️ ${raw?.likes || 0} · 👁️ ${raw?.views || 0}`,
      };
    case 'memes':
      return {
        ...base(raw?.title || raw?.mediaTitle, name, raw?.imageUrl),
        meta: `⬆️ ${raw?.upvotes || 0} · 💬 ${raw?.commentCount || 0}`,
      };
    case 'fanart':
      return {
        ...base(raw?.title || raw?.mediaTitle, name, raw?.imageUrl || raw?.image),
        body: cleanText(raw?.description),
        meta: `❤️ ${raw?.likes || 0}`,
      };
    case 'cosplay':
      return {
        ...base(raw?.character || raw?.title, raw?.animeTitle, raw?.imageUrl),
        body: cleanText(raw?.description),
        meta: `❤️ ${raw?.likes || 0} · ${name || ''}`.trim(),
      };
    case 'blog':
      return {
        ...base(raw?.title, name, raw?.coverImage),
        body: cleanText(raw?.excerpt),
        meta: `${raw?.viewCount || 0} views${raw?.publishedAt ? ` · ${timeAgo(raw.publishedAt)}` : ''}`,
        href: raw?.slug ? `https://zyverse.in/blog/${raw.slug}` : undefined,
      };
    case 'wiki':
      return {
        ...base(raw?.title, raw?.category || name, raw?.coverImage),
        body: cleanText(raw?.summary),
        meta: `v${raw?.version || 1}`,
        href: raw?.slug ? `https://zyverse.in/wiki/${raw.slug}` : undefined,
      };
    case 'achievements':
      return {
        ...base(raw?.name, raw?.category, undefined),
        body: cleanText(raw?.description),
        badge: raw?.earned ? 'EARNED' : `${raw?.points || 0} PTS`,
        meta: raw?.earned && raw?.earnedAt ? timeAgo(raw.earnedAt) : undefined,
      };
    case 'challenges':
      return {
        ...base(raw?.title, `${raw?.period || ''} ${raw?.year || ''}`.trim(), raw?.coverImage),
        body: cleanText(raw?.description),
        badge: raw?.goalCount ? `${raw.goalCount} GOAL` : undefined,
        meta: raw?.endDate ? `Ends ${timeAgo(raw.endDate)}` : undefined,
      };
    case 'tierlist':
      return {
        ...base(raw?.title, `${raw?.itemCount || 0} items · ${raw?.voteCount || 0} votes`, raw?.previewItems?.[0]?.image || raw?.previewItems?.[0]?.imageUrl),
        body: cleanText(raw?.description),
        meta: name,
      };
    case 'merch':
      return {
        ...base(raw?.name, raw?.category, raw?.image),
        body: cleanText(raw?.description),
        badge: raw?.price ? `₹${raw.price}` : undefined,
        meta: raw?.stock ? `${raw.stock} in stock` : undefined,
      };
    case 'watchlist':
    case 'backlog':
      return {
        ...base(raw?.animeTitle || raw?.title || raw?.mediaTitle, raw?.status || name, raw?.coverImage || raw?.image),
        meta: raw?.progress ? `Progress ${raw.progress}` : undefined,
      };
    case 'characters':
      return {
        ...base(raw?.name, raw?.nameNative || raw?.anime, raw?.image || raw?.imageUrl),
        body: cleanText(raw?.description),
        meta: raw?.favourites ? `❤️ ${raw.favourites}` : undefined,
      };
    case 'voice-actors':
      return {
        ...base(raw?.name, raw?.nameNative, raw?.image),
        meta: raw?.favourites ? `❤️ ${raw.favourites}` : undefined,
      };
    case 'contests':
      return {
        ...base(raw?.title, raw?.status || raw?.type, raw?.coverImage || raw?.image),
        body: cleanText(raw?.description),
        meta: raw?.endDate ? `Ends ${timeAgo(raw.endDate)}` : undefined,
      };
    default:
      return {
        ...base(raw?.title || raw?.name, raw?.type || raw?.category, raw?.image || raw?.coverImage || raw?.imageUrl),
        body: cleanText(raw?.description || raw?.summary || raw?.body),
        meta: name,
      };
  }
}

export default function HubScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();

  const kind: string = route.params?.kind || 'community';
  const config = HUBS[kind] || HUBS.community;
  const title: string = route.params?.title || config.title;

  const [cards, setCards] = useState<CardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      // "Surprise Me" is an action, not a list: pick a random trending title
      // and jump straight to its native detail screen.
      if (kind === 'random') {
        const list = await api.trending.get(30);
        if (list.length > 0) {
          const pick = list[Math.floor(Math.random() * list.length)];
          navigation.replace('AnimeDetail', { id: pick.id, title: pick.title });
        } else {
          setError('Could not find anything to surprise you with.');
        }
        setCards([]);
        return;
      }

      if (STATIC_CARDS[kind]) {
        setCards(STATIC_CARDS[kind]);
        return;
      }

      const data: any = await api.get(config.endpoint);
      const list: any[] = Array.isArray(data)
        ? data
        : data?.[config.itemsKey] ||
          data?.items ||
          data?.results ||
          data?.data ||
          [];
      setCards(list.map((raw) => toCard(kind, raw)));
    } catch (e: any) {
      setError(e?.message || 'Could not load this section');
      setCards([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.endpoint, config.itemsKey, kind, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openCard = (card: CardModel) => {
    if (card.screen) {
      navigation.navigate(card.screen, card.params);
      return;
    }
    if (card.href) {
      Linking.openURL(card.href).catch(() => {});
    }
  };

  const renderCard = ({ item }: { item: CardModel }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => openCard(item)}
      activeOpacity={item.href || item.screen ? 0.85 : 1}
    >
      {!!item.image && (
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.badge && (
            <View style={[styles.badge, { backgroundColor: `${config.accent}22` }]}>
              <Text style={[styles.badgeText, { color: config.accent }]}>{item.badge}</Text>
            </View>
          )}
        </View>
        {!!item.subtitle && (
          <Text style={[styles.subtitle, { color: config.accent }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
        )}
        {!!item.body && (
          <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={3}>
            {item.body}
          </Text>
        )}
        <View style={styles.metaRow}>
          {!!item.meta && (
            <Text style={[styles.meta, { color: colors.textDim }]}>{item.meta}</Text>
          )}
          {!!item.href && (
            <Text style={[styles.meta, { color: config.accent }]}>Open →</Text>
          )}
          {!!item.screen && (
            <Text style={[styles.meta, { color: config.accent }]}>Open →</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={title} emoji={config.emoji} subtitle={config.subtitle} accent={config.accent} />

      {loading ? (
        <ActivityIndicator color={config.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>{config.emoji}</Text>
              <Text style={[styles.empty, { color: colors.text }]}>
                {error ? 'Could not load this section' : 'Nothing here yet'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {error ||
                  'New posts appear here as the community adds them. Pull down to refresh.'}
              </Text>
              {!!error && (
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: config.accent }]}
                  onPress={load}
                >
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={renderCard}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  image: { width: '100%', height: 150 },
  cardBody: { padding: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: fontSize.md, fontWeight: '800', lineHeight: 21 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  subtitle: { fontSize: fontSize.xs, fontWeight: '700', marginTop: 3 },
  body: { fontSize: fontSize.sm, lineHeight: 19, marginTop: 6 },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  meta: { fontSize: 11, fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  empty: { fontSize: fontSize.md, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: fontSize.sm, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  retryBtn: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
  retryText: { color: '#0a0a0f', fontSize: fontSize.sm, fontWeight: '900' },
});
