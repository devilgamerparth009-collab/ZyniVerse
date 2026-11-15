import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  ImageBackground,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import {
  AnimeOfTheDay,
  LeaderboardEntry,
  NewsItem,
  PollItem,
  WallpaperItem,
} from '../types';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import AdBanner from '../components/AdBanner';
import { spacing, fontSize, borderRadius } from '../theme';
import { timeAgo } from '../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURE_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;
const WEB_CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 3) / 4;

type Feature = {
  key: string;
  label: string;
  sub: string;
  emoji: string;
  route: string;
  params?: Record<string, any>;
  tint: string;
};

const FEATURES: Feature[] = [
  { key: 'quiz', label: 'Daily Quiz', sub: '5 questions', emoji: '🧠', route: 'Quiz', tint: '#22d3ee' },
  { key: 'plot', label: 'Guess the Plot', sub: '6 tries', emoji: '📖', route: 'Games', params: { mode: 'plot' }, tint: '#a855f7' },
  { key: 'silhouette', label: 'Silhouette', sub: 'Name them', emoji: '🕵️', route: 'Games', params: { mode: 'silhouette' }, tint: '#f472b6' },
  { key: 'ost', label: 'Guess the OST', sub: 'Music round', emoji: '🎵', route: 'Games', params: { mode: 'ost' }, tint: '#f59e0b' },
  { key: 'polls', label: 'Community Polls', sub: 'Cast a vote', emoji: '🗳️', route: 'Polls', tint: '#22c55e' },
  { key: 'leaderboard', label: 'Leaderboard', sub: 'Top fans', emoji: '🏆', route: 'Leaderboard', tint: '#eab308' },
  { key: 'wallpapers', label: 'Wallpapers', sub: '4K anime art', emoji: '🖼️', route: 'Wallpapers', tint: '#38bdf8' },
  { key: 'ostlist', label: 'OP & ED Vault', sub: 'Openings', emoji: '🎧', route: 'OST', tint: '#fb7185' },
  { key: 'tvguide', label: 'TV & Streaming', sub: 'Live EPG', emoji: '📺', route: 'TVGuide', tint: '#60a5fa' },
];

type WebFeature = {
  key: string;
  label: string;
  emoji: string;
  path: string;
  tint: string;
  /** Needs the app's signed-in session (messages, watch party rooms). */
  auth?: boolean;
  /** Opens a native screen instead of the embedded website. */
  nativeRoute?: string;
  /** Params passed to the native screen. */
  nativeParams?: Record<string, any>;
};

type WebGroup = { key: string; title: string; items: WebFeature[] };

/**
 * Web features that do not have a native screen yet. Every entry loads the
 * real zyverse.in page inside the app, so the APK always matches the website.
 */
const WEB_GROUPS: WebGroup[] = [
  {
    key: 'social',
    title: 'Social & Live',
    items: [
      { key: 'messages', label: 'Messages', emoji: '💬', path: '/messages', tint: '#22d3ee', auth: true },
      { key: 'watchparty', label: 'Watch Party', emoji: '👥', path: '/watch-party', tint: '#38bdf8', auth: true, nativeRoute: 'WatchParty' },
      { key: 'vibe', label: 'Vibe', emoji: '📡', path: '/vibe', tint: '#f472b6', nativeRoute: 'Vibe' },
      { key: 'dna', label: 'Anime DNA', emoji: '🧬', path: '/dna', tint: '#a78bfa', nativeRoute: 'TasteProfile' },
      { key: 'community', label: 'Community', emoji: '🌐', path: '/community', tint: '#a78bfa' },
      { key: 'clubs', label: 'Clubs', emoji: '🏛️', path: '/clubs', tint: '#f59e0b', auth: true },
      { key: 'feed', label: 'Social Feed', emoji: '📰', path: '/feed', tint: '#22c55e', auth: true },
      { key: 'friends', label: 'Friends', emoji: '🤝', path: '/friends', tint: '#ec4899', auth: true },
      { key: 'notifications', label: 'Alerts', emoji: '🔔', path: '/notifications', tint: '#f97316', auth: true, nativeRoute: 'Notifications' },
      { key: 'moments', label: 'Moments', emoji: '✨', path: '/moments', tint: '#eab308' },
      { key: 'clips', label: 'Clips', emoji: '✂️', path: '/clips', tint: '#8b5cf6' },
      { key: 'memes', label: 'Memes', emoji: '😂', path: '/memes', tint: '#facc15' },
      { key: 'fanart', label: 'Fan Art', emoji: '🎨', path: '/fanart', tint: '#fb7185' },
      { key: 'cosplay', label: 'Cosplay', emoji: '🎭', path: '/cosplay', tint: '#d946ef' },
    ],
  },
  {
    key: 'explore',
    title: 'Explore & Track',
    items: [
      { key: 'top', label: 'Top Anime', emoji: '🔝', path: '/top-anime', tint: '#f97316', nativeRoute: 'Browse', nativeParams: { mode: 'top-rated', title: 'Top Anime' } },
      { key: 'seasonal', label: 'Seasonal Now', emoji: '🌸', path: '/seasonal', tint: '#22d3ee', nativeRoute: 'Browse', nativeParams: { mode: 'seasonal', title: 'This Season' } },
      { key: 'calendar', label: 'Anime Calendar', emoji: '🗓️', path: '/calendar', tint: '#3b82f6', nativeRoute: 'Schedule' },
      { key: 'watchorder', label: 'Watch Order', emoji: '🧭', path: '/watch-order', tint: '#10b981' },
      { key: 'watchlist', label: 'Watchlist', emoji: '📌', path: '/watchlist', tint: '#f43f5e', auth: true },
      { key: 'tracker', label: 'Season Tracker', emoji: '📊', path: '/seasonal-tracker', tint: '#a855f7' },
      { key: 'characters', label: 'Characters', emoji: '🎭', path: '/characters', tint: '#fb923c' },
      { key: 'va', label: 'Voice Actors', emoji: '🎤', path: '/voice-actors', tint: '#fbbf24' },
      { key: 'manga', label: 'Manga', emoji: '📚', path: '/manga', tint: '#f87171', nativeRoute: 'Manga' },
      { key: 'mangarel', label: 'Manga Releases', emoji: '📖', path: '/manga-releases', tint: '#fb7185' },
      { key: 'lightnovels', label: 'Light Novels', emoji: '📕', path: '/light-novels', tint: '#e879f9' },
      { key: 'blog', label: 'Blog', emoji: '✍️', path: '/blog', tint: '#0ea5e9' },
      { key: 'wiki', label: 'Wiki', emoji: '📜', path: '/wiki', tint: '#84cc16' },
    ],
  },
  {
    key: 'play',
    title: 'Games & More',
    items: [
      { key: 'wordle', label: 'Anime Wordle', emoji: '🟩', path: '/wordle', tint: '#22c55e', nativeRoute: 'Wordle' },
      { key: 'tierlist', label: 'Tier List', emoji: '🏆', path: '/tierlist', tint: '#eab308' },
      { key: 'bingo', label: 'Anime Bingo', emoji: '🎯', path: '/bingo', tint: '#f472b6' },
      { key: 'challenges', label: 'Challenges', emoji: '🔥', path: '/challenges', tint: '#ef4444' },
      { key: 'contests', label: 'Contests', emoji: '🥇', path: '/contests', tint: '#f59e0b' },
      { key: 'achievements', label: 'Achievements', emoji: '🏅', path: '/achievements', tint: '#facc15', auth: true },
      { key: 'merch', label: 'Merch', emoji: '🛍️', path: '/merch', tint: '#34d399' },
      { key: 'premium', label: 'Premium', emoji: '💎', path: '/premium', tint: '#60a5fa' },
      { key: 'tools', label: 'Tools', emoji: '🛠️', path: '/tools', tint: '#94a3b8' },
      { key: 'random', label: 'Surprise Me', emoji: '🎲', path: '/random', tint: '#f472b6' },
    ],
  },
];

function LivePulse({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });

  return <Animated.View style={[styles.liveDot, { backgroundColor: color, opacity, transform: [{ scale }] }]} />;
}

export default function FunZoneScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali, isChristmas } = useTheme();
  const tint = isDiwali ? '#f59e0b' : isChristmas ? '#7dd3fc' : colors.primary;

  const [aotd, setAotd] = useState<AnimeOfTheDay | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [poll, setPoll] = useState<PollItem | null>(null);
  const [walls, setWalls] = useState<WallpaperItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [a, l, n, p, w] = await Promise.allSettled([
      api.fun.animeOfTheDay(),
      api.fun.leaderboard(5, 0),
      api.fun.news('all', 'week'),
      api.fun.polls(1, 1, true),
      api.fun.wallpapers({ sort: 'popular', perPage: 8 }),
    ]);

    if (a.status === 'fulfilled') setAotd(a.value);
    if (l.status === 'fulfilled') setLeaders(l.value.entries || []);
    if (n.status === 'fulfilled') setNews((n.value || []).slice(0, 3));
    if (p.status === 'fulfilled') setPoll(p.value.polls?.[0] || null);
    if (w.status === 'fulfilled') setWalls(w.value.items || []);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const hero = aotd?.anime;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.kicker, { color: tint }]}>ZYNIVERSE PLAYGROUND</Text>
              <Text style={[styles.title, { color: colors.text }]}>Fun Zone</Text>
            </View>
            <View style={[styles.livePill, { borderColor: tint, backgroundColor: `${tint}18` }]}>
              <LivePulse color={tint} />
              <Text style={[styles.liveText, { color: tint }]}>LIVE</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Daily picks, games, polls and anime art — all in one place.
          </Text>
        </View>

        {/* Anime of the day */}
        {hero && (
          <FadeInView delay={40}>
            <PressableScale
              style={styles.heroWrap}
              onPress={() =>
                navigation.navigate('AnimeDetail', { id: hero.id, title: hero.title })
              }
            >
              <ImageBackground
                source={{ uri: hero.image }}
                style={styles.hero}
                imageStyle={{ borderRadius: borderRadius.lg }}
              >
                <View style={styles.heroShade} />
                <View style={styles.heroInner}>
                  <View style={[styles.pickBadge, { backgroundColor: tint }]}>
                    <Text style={styles.pickBadgeText}>🌅 TODAY&apos;S PICK</Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {hero.title}
                  </Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {[
                      hero.format,
                      hero.episodes ? `${hero.episodes} eps` : null,
                      hero.score ? `${(hero.score / 10).toFixed(1)} ★` : null,
                      hero.status,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <View style={styles.genreRow}>
                    {(hero.genres || []).slice(0, 3).map((g) => (
                      <View key={g} style={styles.genreChip}>
                        <Text style={styles.genreText}>{g}</Text>
                      </View>
                    ))}
                  </View>
                  {!!aotd?.why && (
                    <Text style={styles.whyText} numberOfLines={2}>
                      {aotd.why}
                    </Text>
                  )}
                </View>
              </ImageBackground>
            </PressableScale>
          </FadeInView>
        )}

        {/* Feature grid */}
        <FadeInView delay={120}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Play &amp; Discover</Text>
          <View style={styles.grid}>
            {FEATURES.map((f, i) => (
              <FadeInView key={f.key} delay={140 + i * 45} offset={10}>
                <PressableScale
                  style={[
                    styles.featureCard,
                    { width: FEATURE_CARD_WIDTH, backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => navigation.navigate(f.route, f.params)}
                >
                  <View style={[styles.featureGlow, { backgroundColor: `${f.tint}22` }]}>
                    <Text style={styles.featureEmoji}>{f.emoji}</Text>
                  </View>
                  <Text style={[styles.featureLabel, { color: colors.text }]} numberOfLines={1}>
                    {f.label}
                  </Text>
                  <Text style={[styles.featureSub, { color: f.tint }]} numberOfLines={1}>
                    {f.sub}
                  </Text>
                </PressableScale>
              </FadeInView>
            ))}
          </View>
        </FadeInView>

        {/* Poll preview */}
        {poll && (
          <FadeInView delay={200}>
            <PressableScale
              style={[
                styles.pollCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => navigation.navigate('Polls')}
            >
              <View style={styles.pollHead}>
                <Text style={[styles.pollKicker, { color: '#22c55e' }]}>🗳️ LIVE POLL</Text>
                <Text style={[styles.pollCount, { color: colors.textMuted }]}>
                  {poll._count?.votes || 0} votes
                </Text>
              </View>
              <Text style={[styles.pollTitle, { color: colors.text }]} numberOfLines={2}>
                {poll.title}
              </Text>
              {poll.options.slice(0, 2).map((o) => (
                <View key={o.id} style={[styles.pollOption, { borderColor: colors.border }]}>
                  <Text style={[styles.pollOptionText, { color: colors.textMuted }]} numberOfLines={1}>
                    {o.label}
                  </Text>
                </View>
              ))}
              <Text style={[styles.tapHint, { color: '#22c55e' }]}>Tap to vote →</Text>
            </PressableScale>
          </FadeInView>
        )}

        {/* Leaderboard preview */}
        {leaders.length > 0 && (
          <FadeInView delay={240}>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Fans</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
                <Text style={[styles.seeAll, { color: tint }]}>See all →</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {leaders.slice(0, 3).map((entry, i) => (
                <View
                  key={entry.userId}
                  style={[
                    styles.boardRow,
                    i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={styles.medal}>{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</Text>
                  {entry.avatar ? (
                    <Image source={{ uri: entry.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${tint}33` }]}>
                      <Text style={{ color: tint, fontWeight: '800' }}>
                        {entry.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.boardName, { color: colors.text }]} numberOfLines={1}>
                      {entry.username}
                    </Text>
                    <Text style={[styles.boardMeta, { color: colors.textMuted }]}>
                      Lv {entry.level} · {entry.achievements} badges
                    </Text>
                  </View>
                  <Text style={[styles.points, { color: tint }]}>{entry.points.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </FadeInView>
        )}

        {/* Wallpaper strip */}
        {walls.length > 0 && (
          <FadeInView delay={280}>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Wallpaper Drop</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Wallpapers')}>
                <Text style={[styles.seeAll, { color: tint }]}>Browse →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.md }}
            >
              {walls.slice(0, 6).map((w) => (
                <PressableScale
                  key={w.id}
                  onPress={() => navigation.navigate('Wallpapers')}
                  style={styles.wallCard}
                >
                  <Image
                    source={{ uri: w.thumbnailUrl || w.imageUrl }}
                    style={styles.wallImage}
                    resizeMode="cover"
                  />
                  <View style={styles.wallShade} />
                  <Text style={styles.wallTitle} numberOfLines={1}>
                    {w.animeTitle || w.title}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </FadeInView>
        )}

        {/* News preview */}
        {news.length > 0 && (
          <FadeInView delay={320}>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Fresh News</Text>
              <TouchableOpacity onPress={() => navigation.navigate('News')}>
                <Text style={[styles.seeAll, { color: tint }]}>More →</Text>
              </TouchableOpacity>
            </View>
            {news.map((n, i) => (
              <PressableScale
                key={n.id || i}
                onPress={() => navigation.navigate('News')}
                style={[styles.newsRow, { borderBottomColor: colors.border }]}
              >
                {n.image ? (
                  <Image source={{ uri: n.image }} style={styles.newsThumb} />
                ) : (
                  <View style={[styles.newsThumb, { backgroundColor: `${tint}22` }]}>
                    <Text style={{ fontSize: 20 }}>📰</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={2}>
                    {n.title}
                  </Text>
                  <Text style={[styles.newsMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {n.source} · {timeAgo(n.publishedAt)}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </FadeInView>
        )}

        {/* Live & streaming */}
        <FadeInView delay={340}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Now Streaming</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.streamRow}
          >
            {[
              {
                key: 'tv',
                title: 'TV Guide',
                sub: 'Channels · DTH · EPG',
                emoji: '📺',
                tint: '#ef4444',
                onPress: () => navigation.navigate('TVGuide'),
                live: true,
              },
              {
                key: 'reels',
                title: 'Reels',
                sub: 'Clips & edits',
                emoji: '🎬',
                tint: '#f472b6',
                onPress: () => navigation.navigate('Reels'),
                live: false,
              },
              {
                key: 'dubs',
                title: 'Fresh Dub Drops',
                sub: 'Hindi · Tamil · Telugu',
                emoji: '🎙️',
                tint: '#ff9933',
                onPress: () => navigation.navigate('LiveDubs'),
                live: true,
              },
              {
                key: 'dub-calendar',
                title: 'Daily Dub Schedule',
                sub: 'Release times (IST)',
                emoji: '📅',
                tint: '#3b82f6',
                onPress: () => navigation.navigate('DailyDubSchedule'),
                live: true,
              },
            ].map((card) => (
              <PressableScale
                key={card.key}
                onPress={card.onPress}
                style={[
                  styles.streamCard,
                  { backgroundColor: colors.surface, borderColor: `${card.tint}55` },
                ]}
              >
                <View style={[styles.streamGlow, { backgroundColor: `${card.tint}22` }]}>
                  <Text style={styles.streamEmoji}>{card.emoji}</Text>
                </View>
                {card.live && (
                  <View style={styles.streamLiveRow}>
                    <LivePulse color={card.tint} />
                    <Text style={[styles.streamLiveText, { color: card.tint }]}>LIVE</Text>
                  </View>
                )}
                <Text style={[styles.streamTitle, { color: colors.text }]} numberOfLines={1}>
                  {card.title}
                </Text>
                <Text style={[styles.streamSub, { color: card.tint }]} numberOfLines={1}>
                  {card.sub}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </FadeInView>

        {/* More from the website */}
        <FadeInView delay={380}>
          <View style={styles.sectionHeadRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>More from ZyniVerse</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Web', { title: 'ZyniVerse', path: '/', auth: true })
              }
            >
              <Text style={[styles.seeAll, { color: tint }]}>Full site →</Text>
            </TouchableOpacity>
          </View>

          {WEB_GROUPS.map((group, gi) => (
            <View key={group.key}>
              <Text style={[styles.webGroupTitle, { color: colors.textMuted }]}>
                {group.title}
              </Text>
              <View style={styles.webGrid}>
                {group.items.map((f, i) => (
                  <FadeInView key={f.key} delay={400 + gi * 120 + i * 25} offset={8}>
                    <PressableScale
                      style={[
                        styles.webCard,
                        { width: WEB_CARD_WIDTH, backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() =>
                        f.nativeRoute
                          ? navigation.navigate(f.nativeRoute, f.nativeParams)
                          : navigation.navigate('Web', {
                              title: f.label,
                              path: f.path,
                              auth: f.auth,
                            })
                      }
                    >
                      <Text style={styles.webEmoji}>{f.emoji}</Text>
                      <Text style={[styles.webLabel, { color: colors.text }]} numberOfLines={2}>
                        {f.label}
                      </Text>
                      <View style={[styles.webDot, { backgroundColor: f.tint }]} />
                    </PressableScale>
                  </FadeInView>
                ))}
              </View>
            </View>
          ))}

          <PressableScale
            style={[styles.openSiteBtn, { borderColor: tint, backgroundColor: `${tint}14` }]}
            onPress={() =>
              navigation.navigate('Web', { title: 'ZyniVerse', path: '/', auth: true })
            }
          >
            <Text style={[styles.openSiteText, { color: tint }]}>
              🌐 Open the full ZyniVerse website
            </Text>
            <Text style={[styles.openSiteSub, { color: colors.textMuted }]}>
              Every page, signed in with your account
            </Text>
          </PressableScale>
        </FadeInView>

        <AdBanner placement="home-bottom" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  hero: {
    height: 250,
    justifyContent: 'flex-end',
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  heroInner: {
    padding: spacing.md,
  },
  pickBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  pickBadgeText: {
    color: '#08090f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  genreText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  whyText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginRight: spacing.md,
  },
  seeAll: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  streamRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  streamCard: {
    width: 156,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 132,
  },
  streamGlow: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  streamEmoji: { fontSize: 20 },
  streamLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  streamLiveText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  streamTitle: { fontSize: fontSize.sm, fontWeight: '800' },
  streamSub: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  webGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  webGroupTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  openSiteBtn: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  openSiteText: { fontSize: fontSize.sm, fontWeight: '800' },
  openSiteSub: { fontSize: 10, textAlign: 'center' },
  webCard: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    alignItems: 'center',
    minHeight: 84,
    justifyContent: 'center',
  },
  webEmoji: { fontSize: 22, marginBottom: 4 },
  webLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 13 },
  webDot: { width: 14, height: 2, borderRadius: 1, marginTop: 6 },
  featureCard: {
    width: 160,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    margin: spacing.xs + 2,
  },
  featureGlow: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureLabel: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  featureSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  pollCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  pollHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pollKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pollCount: {
    fontSize: 10,
  },
  pollTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  pollOption: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  pollOptionText: {
    fontSize: fontSize.xs,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  board: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  medal: {
    width: 26,
    fontSize: 16,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  boardMeta: {
    fontSize: 10,
    marginTop: 1,
  },
  points: {
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
  wallCard: {
    width: 120,
    height: 170,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  wallImage: {
    width: '100%',
    height: '100%',
  },
  wallShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  wallTitle: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  newsThumb: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  newsMeta: {
    fontSize: 10,
    marginTop: 3,
  },
});
