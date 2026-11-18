import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { api, getCurrentUser } from '../services/api';
import { Anime, AnimeOfTheDay, User, WatchlistItem } from '../types';
import { animePoster, animeTitle, LIST_STATUS_LABEL } from '../utils/helpers';
import ShowcaseRail from '../components/ShowcaseRail';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import AdBanner from '../components/AdBanner';
import Snowfall from '../components/Snowfall';
import ChristmasBanner from '../components/ChristmasBanner';
import { useTheme } from '../hooks/useTheme';

const FEED_DISMISSED_KEY = 'zv_feed_dismissed';

interface MobileFeed {
  updatedAt?: string;
  announcement?: {
    active?: boolean;
    id: string;
    emoji?: string;
    title: string;
    message?: string;
    ctaLabel?: string;
    ctaScreen?: string;
    ctaParams?: Record<string, any>;
    tint?: string;
  } | null;
  spotlight?: {
    id: string;
    emoji?: string;
    title: string;
    subtitle?: string;
    screen?: string;
    params?: Record<string, any>;
    tint?: string;
  }[];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali, isChristmas } = useTheme();
  const primaryColor = isDiwali ? '#FF8C00' : isChristmas ? '#7dd3fc' : colors.primary;

  const [trending, setTrending] = useState<Anime[]>([]);
  const [popular, setPopular] = useState<Anime[]>([]);
  const [seasonal, setSeasonal] = useState<Anime[]>([]);
  const [topRated, setTopRated] = useState<Anime[]>([]);
  const [upcoming, setUpcoming] = useState<Anime[]>([]);
  const [continueWatching, setContinueWatching] = useState<{ entry: WatchlistItem; anime: Anime }[]>([]);
  const [aotd, setAotd] = useState<AnimeOfTheDay | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [feed, setFeed] = useState<MobileFeed | null>(null);
  const [dismissedFeedId, setDismissedFeedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      if (!isRefresh) setLoading(true);

      const [trendingRes, popularRes, seasonalRes, topRes, upcomingRes, aotdRes, feedRes] = await Promise.all([
        api.trending.get(12).catch(() => [] as Anime[]),
        api.popular.get(12).catch(() => [] as Anime[]),
        api.seasonal.get(12).catch(() => [] as Anime[]),
        api.topRated.get(12).catch(() => [] as Anime[]),
        api.upcoming.get(1, 12).then((p) => p.media).catch(() => [] as Anime[]),
        api.fun.animeOfTheDay().catch(() => null),
        api.get<MobileFeed>('/mobile/feed').catch(() => null),
      ]);
      setTrending(trendingRes);
      setPopular(popularRes);
      setSeasonal(seasonalRes);
      setTopRated(topRes);
      setUpcoming(upcomingRes);
      setAotd(aotdRes);
      setFeed(feedRes);

      const current = await getCurrentUser();
      setUser(current);

      if (current) {
        const [watchlist, count] = await Promise.all([
          api.watchlist.get().catch(() => [] as WatchlistItem[]),
          api.notifications.unreadCount().catch(() => 0),
        ]);
        setUnread(count);

        const active = watchlist
          .filter((w) => w.status === 'CURRENT' || w.status === 'REWATCHING')
          .slice(0, 10);
        if (active.length > 0) {
          const media = await api.batch(active.map((w) => w.mediaId)).catch(() => [] as Anime[]);
          const byId = new Map(media.map((m) => [m.id, m]));
          setContinueWatching(
            active
              .filter((w) => byId.has(w.mediaId))
              .map((w) => ({ entry: w, anime: byId.get(w.mediaId)! }))
          );
        } else {
          setContinueWatching([]);
        }
      } else {
        setContinueWatching([]);
        setUnread(0);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load home feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    AsyncStorage.getItem(FEED_DISMISSED_KEY)
      .then((value) => {
        if (value) setDismissedFeedId(value);
      })
      .catch(() => {});
  }, []);

  // Refresh the continue-watching row whenever the tab regains focus so
  // progress changes made on other screens are reflected immediately.
  useFocusEffect(
    useCallback(() => {
      if (!loading) fetchData(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const openBrowse = (mode: string, title: string) =>
    navigation.navigate('Browse', { mode, title });

  const featured = trending[0];

  if (loading) return <LoadingSpinner fullScreen />;

  if (error && trending.length === 0) {
    return <ErrorView message={error} onRetry={() => fetchData()} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View>
            <Text style={[styles.brand, { color: colors.text }]}>ZyniVerse</Text>
            {isChristmas && (
              <View style={styles.xmasLights} accessibilityLabel="Christmas lights">
                {['#f472b6', '#7dd3fc', '#f8fafc', '#facc15', '#34d399'].map((light) => (
                  <View key={light} style={[styles.xmasBulb, { backgroundColor: light }]} />
                ))}
              </View>
            )}
            <Text style={[styles.greeting, { color: colors.textMuted }]}>
              {user ? `Hey, ${user.username}` : 'Your anime universe'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Messages')}
              accessibilityLabel="Messages"
            >
              <Text style={styles.iconText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('WatchParty')}
              accessibilityLabel="Watch Party"
            >
              <Text style={styles.iconText}>👥</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Search')}
              accessibilityLabel="Search"
            >
              <Text style={styles.iconText}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
            >
              <Text style={styles.iconText}>🔔</Text>
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Action Navigation Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, marginBottom: 14 }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
            }}
            onPress={() => navigation.navigate('FunZone')}
          >
            <Text style={{ color: '#08090f', fontSize: 12, fontWeight: '900' }}>🎮 Fun Zone</Text>
          </TouchableOpacity>

          {isDiwali && (
            <TouchableOpacity
              style={{
                backgroundColor: '#FF8C00',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
              }}
              onPress={() => navigation.navigate('Browse', { mode: 'trending', title: 'Diwali Specials' })}
            >
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>🎆 Diwali Special</Text>
            </TouchableOpacity>
          )}

          {isChristmas && (
            <TouchableOpacity
              style={{
                backgroundColor: '#7dd3fc',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
              }}
              onPress={() => navigation.navigate('Browse', { mode: 'trending', title: 'Christmas Specials' })}
            >
              <Text style={{ color: '#06111f', fontSize: 12, fontWeight: '900' }}>❄️ Christmas Specials</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
            }}
            onPress={() => navigation.navigate('Dubbed')}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>🎙️ Hindi & Eng Dubs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
            }}
            onPress={() => navigation.navigate('HindiDub')}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>🇮🇳 Hindi Dub Library</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
            }}
            onPress={() => navigation.navigate('HindiDub', { tab: 'schedule' })}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>🗓 Dub Timetable</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
            }}
            onPress={() => navigation.navigate('Tournaments')}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>⚔️ Character Battles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
            }}
            onPress={() => navigation.navigate('Recommendations')}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>✨ For You</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Server-driven announcement. Edited in src/content/mobile-feed.json,
            so it appears in every installed app without an APK update. */}
        {feed?.announcement?.active && feed.announcement.id !== dismissedFeedId && (
          <FadeInView delay={20}>
            <View
              style={[
                styles.announcement,
                {
                  backgroundColor: colors.surface,
                  borderColor: `${feed.announcement.tint || primaryColor}66`,
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.announcementGlow,
                  { backgroundColor: `${feed.announcement.tint || primaryColor}1f` },
                ]}
              />
              <View style={styles.announcementTop}>
                <View
                  style={[
                    styles.announcementEmoji,
                    { backgroundColor: `${feed.announcement.tint || primaryColor}22` },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{feed.announcement.emoji || '📣'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.announcementTitle, { color: colors.text }]}>
                    {feed.announcement.title}
                  </Text>
                  {!!feed.announcement.message && (
                    <Text style={[styles.announcementBody, { color: colors.textMuted }]}>
                      {feed.announcement.message}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const id = feed.announcement!.id;
                    setDismissedFeedId(id);
                    AsyncStorage.setItem(FEED_DISMISSED_KEY, id).catch(() => {});
                  }}
                  accessibilityLabel="Dismiss announcement"
                  hitSlop={8}
                >
                  <Text style={{ color: colors.textDim, fontSize: 15, fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>
              {!!feed.announcement.ctaLabel && (
                <TouchableOpacity
                  style={[
                    styles.announcementCta,
                    { backgroundColor: feed.announcement.tint || primaryColor },
                  ]}
                  onPress={() => {
                    const target = feed.announcement?.ctaScreen;
                    if (target) navigation.navigate(target, feed.announcement?.ctaParams);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.announcementCtaText}>{feed.announcement.ctaLabel} →</Text>
                </TouchableOpacity>
              )}
            </View>
          </FadeInView>
        )}

        {/* Server-pushed spotlight cards */}
        {!!feed?.spotlight?.length && (
          <FadeInView delay={30}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>✨ From ZyniVerse</Text>
              <Text style={[styles.seeAll, { color: colors.textDim }]}>Live from server</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.md,
                gap: 10,
                paddingBottom: spacing.md,
              }}
            >
              {feed.spotlight.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={card.screen ? 0.85 : 1}
                  onPress={() => card.screen && navigation.navigate(card.screen, card.params)}
                  style={[
                    styles.spotlightCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: `${card.tint || primaryColor}55`,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{card.emoji || '✨'}</Text>
                  <Text style={[styles.spotlightTitle, { color: colors.text }]} numberOfLines={2}>
                    {card.title}
                  </Text>
                  {!!card.subtitle && (
                    <Text style={[styles.spotlightSub, { color: colors.textMuted }]} numberOfLines={2}>
                      {card.subtitle}
                    </Text>
                  )}
                  <Text style={[styles.spotlightOpen, { color: card.tint || primaryColor }]}>
                    Open →
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </FadeInView>
        )}

        {isChristmas && (
          <ChristmasBanner
            onPress={() =>
              navigation.navigate('Browse', { mode: 'trending', title: 'Christmas Specials' })
            }
          />
        )}

        {featured && (
          <FadeInView delay={40} duration={480}>
            <TouchableOpacity
              activeOpacity={0.92}
              style={styles.hero}
              onPress={() =>
                navigation.navigate('AnimeDetail', {
                  id: featured.id,
                  title: animeTitle(featured),
                })
              }
            >
              <ImageBackground
                source={{ uri: featured.bannerImage || animePoster(featured) }}
                style={styles.heroImage}
                imageStyle={styles.heroImageRadius}
              >
                <View style={styles.heroOverlay} />
                <View style={styles.heroContent}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>#1 TRENDING</Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {animeTitle(featured)}
                  </Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {[
                      featured.format,
                      featured.episodes ? `${featured.episodes} eps` : null,
                      featured.averageScore ? `${featured.averageScore}%` : null,
                      featured.seasonYear,
                    ]
                      .filter(Boolean)
                      .join('  ')}
                  </Text>
                  <View style={styles.heroButton}>
                    <Text style={styles.heroButtonText}>View Details</Text>
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </FadeInView>
        )}

        {/* Anime of the Day  surfaced from the website API */}
        {aotd?.anime && (
          <FadeInView delay={90} duration={460}>
            <View style={styles.aotdSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>🌟 Anime of the Day</Text>
                <TouchableOpacity onPress={() => navigation.navigate('FunZone')}>
                  <Text style={styles.seeAll}>Fun Zone →</Text>
                </TouchableOpacity>
              </View>
              <PressableScale
                onPress={() =>
                  navigation.navigate('AnimeDetail', {
                    id: aotd.anime.id,
                    title: aotd.anime.title,
                  })
                }
              >
                <View style={[styles.aotdCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Image source={{ uri: aotd.anime.image }} style={styles.aotdImage} resizeMode="cover" />
                  <View style={styles.aotdBody}>
                    <Text style={styles.aotdTitle} numberOfLines={2}>
                      {aotd.anime.title}
                    </Text>
                    <Text style={styles.aotdMeta} numberOfLines={1}>
                      {[
                        aotd.anime.format,
                        aotd.anime.episodes ? `${aotd.anime.episodes} eps` : null,
                        aotd.anime.score ? `${(aotd.anime.score / 10).toFixed(1)} ★` : null,
                      ]
                        .filter(Boolean)
                        .join('  ')}
                    </Text>
                    <Text style={styles.aotdWhy} numberOfLines={2}>
                      {aotd.why}
                    </Text>
                    <View style={styles.aotdGenres}>
                      {(aotd.anime.genres || []).slice(0, 2).map((g) => (
                        <View key={g} style={styles.aotdChip}>
                          <Text style={styles.aotdChipText}>{g}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </PressableScale>
            </View>
          </FadeInView>
        )}

        {/* Adsterra Sponsored Ad Banner */}
        <AdBanner placement="home-bottom" />

        {!user && (
          <TouchableOpacity
            style={styles.loginBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Login')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.loginTitle}>Sign in to sync your list</Text>
              <Text style={styles.loginSubtitle}>
                Track episodes, rate anime, and join the forum.
              </Text>
            </View>
            <Text style={styles.loginArrow}>→</Text>
          </TouchableOpacity>
        )}

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Recommendations')}
          >
            <Text style={styles.quickIcon}>✨</Text>
            <Text style={styles.quickLabel}>For You</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Browse', { mode: 'seasonal', title: 'This Season' })}
          >
            <Text style={styles.quickIcon}>🌸</Text>
            <Text style={styles.quickLabel}>Seasonal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('HindiDub', { tab: 'schedule' })}
          >
            <Text style={styles.quickIcon}>🕒</Text>
            <Text style={styles.quickLabel}>Dub Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('Forum')}
          >
            <Text style={styles.quickIcon}>💬</Text>
            <Text style={styles.quickLabel}>Forum</Text>
          </TouchableOpacity>
        </View>

        {/* Live & fresh row */}
        <ScrollView
          horizontal
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.lg }}
        >
          {[
            { icon: '📺', label: 'Live TV', sub: 'Channels & OTT', route: 'TVGuide', tint: '#ef4444' },
            { icon: '🎬', label: 'Reels', sub: 'Clips & edits', route: 'Reels', tint: '#f472b6' },
            { icon: '🇮🇳', label: 'Dub Hub', sub: 'Series · Movies · Schedule', route: 'HindiDub', params: { tab: 'all' }, tint: '#ff9933' },
            { icon: '🧰', label: 'All Features', sub: 'Every feature in one place', route: 'AllFeatures', tint: '#a78bfa' },
            { icon: '🟩', label: 'Wordle', sub: 'Daily puzzle', route: 'Wordle', tint: '#22c55e' },
          ].map((item: any) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(item.route, item.params)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.surface,
                borderColor: `${item.tint}55`,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 9,
              }}
            >
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              <View>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>{item.label}</Text>
                <Text style={{ color: item.tint, fontSize: 9, fontWeight: '700' }}>{item.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={styles.dubBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Dubbed')}
        >
          <Text style={styles.dubBannerIcon}></Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.dubBannerTitle}>Anime Dubs</Text>
            <Text style={styles.dubBannerSubtitle}>
              Hindi, Tamil, Telugu & English dubs in one place.
            </Text>
          </View>
          <Text style={styles.loginArrow}>→</Text>
        </TouchableOpacity>

        {continueWatching.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Continue Watching</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.seeAll}>My List</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
            >
              {continueWatching.map(({ entry, anime }) => (
                <TouchableOpacity
                  key={entry.mediaId}
                  style={styles.continueCard}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('AnimeDetail', {
                      id: anime.id,
                      title: animeTitle(anime),
                    })
                  }
                >
                  <View style={styles.continueImageWrap}>
                    {animePoster(anime) ? (
                      <Image
                        source={{ uri: animePoster(anime) }}
                        style={styles.continueImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.continueImage, styles.placeholder]}>
                        <Text style={styles.placeholderText}>?</Text>
                      </View>
                    )}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${
                              entry.total > 0
                                ? Math.min(100, (entry.progress / entry.total) * 100)
                                : 0
                            }%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.continueTitle} numberOfLines={2}>
                    {animeTitle(anime)}
                  </Text>
                  <Text style={styles.continueMeta}>
                    Ep {entry.progress}
                    {entry.total ? ` / ${entry.total}` : ''}  {LIST_STATUS_LABEL[entry.status]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <ShowcaseRail
          title="Trending Now"
          subtitle="What everyone is bingeing today"
          anime={trending}
          variant="trending"
          accent={isDiwali ? '#fb923c' : isChristmas ? '#7dd3fc' : undefined}
          onSeeAll={() => openBrowse('trending', 'Trending Now')}
        />
        <ShowcaseRail
          title="Popular This Season"
          subtitle="Ranked by fandom heat"
          anime={popular}
          variant="popular"
          onSeeAll={() => openBrowse('popular', 'Popular')}
        />
        <ShowcaseRail
          title="This Season"
          subtitle="Fresh episodes, week by week"
          anime={seasonal}
          variant="seasonal"
          accent={isChristmas ? '#7dd3fc' : undefined}
          onSeeAll={() => openBrowse('seasonal', 'This Season')}
        />
        <ShowcaseRail
          title="Top Rated"
          subtitle="The all-time greats"
          anime={topRated}
          variant="topRated"
          onSeeAll={() => openBrowse('top-rated', 'Top Rated')}
        />
        <ShowcaseRail
          title="Upcoming"
          subtitle="Set your reminders now"
          anime={upcoming}
          variant="upcoming"
          onSeeAll={() => openBrowse('upcoming', 'Upcoming')}
        />

        <TouchableOpacity
          style={styles.forumBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Forum')}
        >
          <Text style={styles.forumBannerIcon}></Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.forumBannerTitle}>Join the community</Text>
            <Text style={styles.forumBannerSubtitle}>
              Discuss episodes, share theories, and meet other fans.
            </Text>
          </View>
          <Text style={styles.loginArrow}>→</Text>
        </TouchableOpacity>

        {/* Scrollable in-feed AdBanner (Never sticks to bottom) */}
        <AdBanner size="banner" />
      </ScrollView>

      {isChristmas && <Snowfall />}
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  brand: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  greeting: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  xmasLights: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    marginBottom: 2,
  },
  xmasBulb: {
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hero: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  heroImage: {
    height: 210,
    justifyContent: 'flex-end',
  },
  heroImageRadius: {
    borderRadius: borderRadius.lg,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.55)',
  },
  heroContent: {
    padding: spacing.md,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  heroBadgeText: {
    color: '#0a0a0f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: fontSize.xl,
    fontWeight: '800',
    lineHeight: 26,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.text,
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  loginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.35)',
  },
  loginTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  loginSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  loginArrow: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  quickIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  quickLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.primary,
    fontSize: fontSize.sm,
  },
  aotdSection: {
    marginBottom: spacing.lg,
  },
  aotdCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  aotdImage: {
    width: 104,
    height: 148,
  },
  aotdBody: {
    flex: 1,
    padding: spacing.sm + 2,
    justifyContent: 'center',
  },
  aotdTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
    lineHeight: 21,
  },
  aotdMeta: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  aotdWhy: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
    fontStyle: 'italic',
  },
  aotdGenres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  aotdChip: {
    backgroundColor: 'rgba(0,255,224,0.12)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 5,
  },
  aotdChipText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '700',
  },
  hScroll: {
    paddingHorizontal: spacing.md,
  },
  continueCard: {
    width: 132,
    marginRight: spacing.sm,
  },
  continueImageWrap: {
    width: 132,
    height: 186,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  continueImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textDim,
    fontSize: 24,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  continueTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  continueMeta: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  dubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
  },
  dubBannerIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  dubBannerTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  dubBannerSubtitle: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  forumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  forumBannerIcon: {
    color: colors.secondary,
    fontSize: 26,
    marginRight: spacing.md,
  },
  forumBannerTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  forumBannerSubtitle: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  announcement: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  announcementGlow: {
    position: 'absolute',
    right: -50,
    top: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  announcementTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  announcementEmoji: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementTitle: {
    fontSize: fontSize.md,
    fontWeight: '900',
    lineHeight: 19,
  },
  announcementBody: {
    fontSize: fontSize.xs,
    lineHeight: 17,
    marginTop: 3,
  },
  announcementCta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  announcementCtaText: {
    color: '#0a0a0f',
    fontSize: 11,
    fontWeight: '900',
  },
  spotlightCard: {
    width: 156,
    minHeight: 132,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  spotlightTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  spotlightSub: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 3,
  },
  spotlightOpen: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
}));
