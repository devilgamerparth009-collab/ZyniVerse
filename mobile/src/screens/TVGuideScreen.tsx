import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { TvChannelEntry, TvTimeSlot } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import AdBanner from '../components/AdBanner';
import { spacing, borderRadius } from '../theme';
import { webAbsoluteUrl } from '../utils/helpers';

const TV_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const SOURCE_LABELS: Record<string, string> = {
  epg: 'epg.pw',
  live: 'AniList',
  fallback: 'Offline guide',
  empty: 'No source',
};
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - 10) / 2;

/** epg.pw and AniList both publish IST slots, so the phone clock must be IST too. */
function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function getTodayDayName() {
  return TV_DAYS[istNow().getUTCDay()];
}

function rotateDaysFromToday(dayNames: string[]): string[] {
  const unique = Array.from(new Set(dayNames.filter((d) => TV_DAYS.includes(d))));
  const today = getTodayDayName();
  const idx = unique.indexOf(today);
  if (idx <= 0) return unique.length ? unique : [...TV_DAYS.slice(TV_DAYS.indexOf(today)), ...TV_DAYS.slice(0, TV_DAYS.indexOf(today))];
  return [...unique.slice(idx), ...unique.slice(0, idx)];
}

function weekDaysFromToday(): string[] {
  const todayIdx = TV_DAYS.indexOf(getTodayDayName());
  return Array.from({ length: 7 }, (_, i) => TV_DAYS[(todayIdx + i) % 7]);
}

/** Calendar date for a weekday inside the current 7-day window starting today. */
function dateForDay(dayName: string): Date {
  const todayIdx = istNow().getUTCDay();
  const idx = TV_DAYS.indexOf(dayName);
  const diff = idx < 0 ? 0 : (idx - todayIdx + 7) % 7;
  return new Date(istNow().getTime() + diff * 86_400_000);
}

function formatDayDate(dayName: string): string {
  const d = dateForDay(dayName);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${month[d.getUTCMonth()]}`;
}

function sourceLabel(entry: TvChannelEntry): string {
  return entry.sourceLabel || SOURCE_LABELS[entry.source || 'empty'] || 'Live guide';
}

function nowMinutes() {
  const d = istNow();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function currentSlot(slots?: TvTimeSlot[]): TvTimeSlot | null {
  if (!slots?.length) return null;
  const mins = nowMinutes();
  return (
    slots.find((slot) => {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const start = sh * 60 + (sm || 0);
      const end = eh * 60 + (em || 0);
      if (start > end) return mins >= start || mins < end;
      return mins >= start && mins < end;
    }) || null
  );
}

function nextSlot(slots?: TvTimeSlot[]): TvTimeSlot | null {
  if (!slots?.length) return null;
  const mins = nowMinutes();
  return (
    slots.find((slot) => {
      const [sh, sm] = slot.start.split(':').map(Number);
      return sh * 60 + (sm || 0) > mins;
    }) || null
  );
}

/** 0–1 progress through the currently airing slot (0 when not airing). */
function slotProgress(slot: TvTimeSlot | null): number {
  if (!slot) return 0;
  const mins = nowMinutes();
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);
  const start = sh * 60 + (sm || 0);
  let end = eh * 60 + (em || 0);
  if (end <= start) end += 24 * 60;
  const adjusted = mins < start ? mins + 24 * 60 : mins;
  return Math.min(1, Math.max(0, (adjusted - start) / (end - start)));
}

function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/** Animated skeleton used while the first grid loads. */
function Skeleton({ colors }: { colors: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <View style={{ paddingHorizontal: spacing.md, gap: 10, marginTop: spacing.md }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.9, 0.45] }),
            },
          ]}
        >
          <View style={[styles.skeletonLogo, { backgroundColor: colors.surfaceLight || colors.border }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 12, width: '55%', borderRadius: 6, backgroundColor: colors.surfaceLight || colors.border }} />
            <View style={{ height: 9, width: '80%', borderRadius: 5, backgroundColor: colors.surfaceLight || colors.border }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * Channel logo tile.
 *
 * Two things used to make these look broken inside the APK:
 *  1. the image was loaded straight from Wikimedia, which answers app traffic
 *     with 429 Too Many Requests — now it goes through our cached proxy;
 *  2. a dark wordmark (Cartoon Network, POGO, SonyLIV) was drawn on a dark
 *     tile, so even a successfully loaded logo was invisible — the plate is
 *     now picked per channel (`logoPlate`).
 */
function ChannelBadge({
  channel,
  size = 48,
  rounded,
}: {
  channel: any;
  size?: number;
  rounded?: number;
}) {
  const [imgError, setImgError] = React.useState(false);
  const ch = channel || {};
  const logoSrc = webAbsoluteUrl(ch.logoProxyUrl || ch.logoUrl);
  const showImg = !!logoSrc && !imgError;
  const brandColor = ch.color || '#3b82f6';
  const label = ch.shortName || ch.name || 'TV';
  const plate = ch.logoPlate === 'dark' ? '#0b0b14' : '#f6f7fb';
  const radius = rounded ?? Math.round(size * 0.3);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: plate,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${brandColor}77`,
        padding: Math.max(3, Math.round(size * 0.1)),
        shadowColor: brandColor,
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
      }}
    >
      {showImg ? (
        <Image
          source={{ uri: logoSrc }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              color: brandColor,
              fontSize: label.length > 4 ? Math.max(7, size * 0.17) : Math.max(8, size * 0.21),
              fontWeight: '900',
              letterSpacing: 0.4,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View
            style={{
              width: Math.max(10, size * 0.28),
              height: 2.5,
              borderRadius: 2,
              backgroundColor: brandColor,
              marginTop: 3,
            }}
          />
        </View>
      )}
    </View>
  );
}

export default function TVGuideScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isLaunch, isChristmas } = useTheme();
  const tint = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : colors.primary;

  const [channels, setChannels] = useState<TvChannelEntry[]>([]);
  const [days, setDays] = useState<string[]>(weekDaysFromToday());
  const [day, setDay] = useState<string>(getTodayDayName());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<TvChannelEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'tv' | 'streaming'>('all');
  const [query, setQuery] = useState('');
  const [offline, setOffline] = useState(false);
  // Re-renders the live progress bars once a minute without refetching.
  const [, setClockTick] = useState(0);
  const dayRef = useRef(day);
  dayRef.current = day;

  const applyOffline = useCallback((payload?: { offlineLinear?: boolean; channels?: TvChannelEntry[] }) => {
    if (!payload) return;
    setOffline(
      !!payload.offlineLinear ||
        (payload.channels || []).some((c) => c.source === 'fallback')
    );
  }, []);

  const load = useCallback(async (selectedDay?: string) => {
    try {
      setError(null);
      const base = await api.fun.tvSchedule(selectedDay);
      if (base?.channels?.length) {
        setChannels(base.channels);
        if (base.availableDays?.length) setDays(rotateDaysFromToday(base.availableDays));
        if (base.day) setDay(base.day);
        setUpdatedAt(base.updatedAt || null);
        applyOffline(base);
      } else {
        setChannels([]);
        setError('No listings came back from the guide. Pull down to retry.');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load the TV guide.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyOffline]);

  useEffect(() => {
    // Paint the last good grid immediately, then refresh underneath. The guide
    // is the slowest screen on a cold cache, so it must never block on network.
    let cancelled = false;
    (async () => {
      const cached = await api.fun.tvSchedulePeek();
      if (cancelled || !cached?.channels?.length) return;
      setChannels(cached.channels);
      if (cached.availableDays?.length) setDays(rotateDaysFromToday(cached.availableDays));
      if (cached.day) setDay(cached.day);
      setUpdatedAt(cached.updatedAt || null);
      applyOffline(cached);
      setLoading(false);
    })();
    load();
    return () => {
      cancelled = true;
    };
  }, [load, applyOffline]);

  // Keep the grid fresh while the user is on this screen. The server result is
  // cheap after its first scrape, so a minute poll is enough for live timing.
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        setClockTick((tick) => tick + 1);
        load(dayRef.current);
      }, 60_000);
      return () => clearInterval(timer);
    }, [load])
  );

  const visible = useMemo(() => {
    let list = channels;
    if (filter === 'tv') list = list.filter((c) => c.channel.type === 'tv');
    else if (filter === 'streaming') list = list.filter((c) => c.channel.type !== 'tv');
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((entry) => {
        if (entry.channel.name.toLowerCase().includes(q)) return true;
        return (entry.schedule?.slots || []).some((s) => s.show.toLowerCase().includes(q));
      });
    }
    return list;
  }, [channels, filter, query]);

  const liveNow = useMemo(
    () =>
      channels
        .map((entry) => ({ entry, slot: currentSlot(entry.schedule?.slots) }))
        .filter((x) => !!x.slot),
    [channels]
  );

  const totalSlots = useMemo(
    () => channels.reduce((acc, c) => acc + (c.schedule?.slots?.length || 0), 0),
    [channels]
  );

  const sourceSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of visible) {
      const label = sourceLabel(entry);
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => `${label} ${count}`)
      .join(' · ');
  }, [visible]);

  const onRefresh = () => {
    setRefreshing(true);
    load(day);
  };

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="TV & Streaming"
        subtitle={
          updatedLabel
            ? `${channels.length} channels · ${totalSlots} airings · ${updatedLabel}`
            : 'Live TV · Channel numbers · New drops'
        }
        emoji="📺"
        accent={tint}
      />
      <View style={{ paddingHorizontal: spacing.md }}>
        <AdBanner placement="tv-guide" size="banner" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
      >
        {/* Command centre: day, live count and coverage at a glance */}
        <FadeInView delay={0}>
          <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: `${tint}44` }]}>
            <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: `${tint}22` }]} />
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.heroLive,
                  { backgroundColor: liveNow.length ? '#ef444422' : colors.background },
                ]}
              >
                <LiveDot color={liveNow.length ? '#ef4444' : colors.textDim} size={6} />
                <Text
                  style={[
                    styles.heroLiveText,
                    { color: liveNow.length ? '#ef4444' : colors.textMuted },
                  ]}
                >
                  {liveNow.length ? `${liveNow.length} LIVE` : 'OFF AIR'}
                </Text>
              </View>
              <Text style={[styles.heroDate, { color: colors.textMuted }]}>
                {day} · {formatDayDate(day)}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>What’s on right now</Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              {totalSlots > 0
                ? `${channels.length} channels · ${totalSlots} airings · ${
                    sourceSummary || (offline ? 'offline guide' : 'Live TV')
                  }`
                : 'Loading the live guide…'}
            </Text>
            <View style={styles.heroStats}>
              {[
                { label: 'Channels', value: channels.length },
                { label: 'Live now', value: liveNow.length },
                { label: 'Airings', value: totalSlots },
              ].map((stat) => (
                <View key={stat.label} style={[styles.heroStat, { borderColor: colors.border }]}>
                  <Text style={[styles.heroStatValue, { color: tint }]}>{stat.value}</Text>
                  <Text style={[styles.heroStatLabel, { color: colors.textMuted }]}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInView>

        {/* Live now strip */}
        <FadeInView delay={20}>
          <View style={styles.liveHead}>
            <LiveDot color={liveNow.length ? '#ef4444' : colors.textDim} />
            <Text style={[styles.liveLabel, { color: liveNow.length ? '#ef4444' : colors.textMuted }]}>
              {liveNow.length ? `ON AIR NOW · ${liveNow.length} CHANNELS` : 'NOTHING LIVE RIGHT NOW'}
            </Text>
            <View style={styles.liveHeadSpacer} />
            {offline && (
              <View style={[styles.offlinePill, { borderColor: `${colors.warning}66`, backgroundColor: `${colors.warning}18` }]}>
                <Text style={[styles.offlinePillText, { color: colors.warning }]}>OFFLINE GUIDE</Text>
              </View>
            )}
          </View>
        </FadeInView>

        {liveNow.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveStrip}>
            {liveNow.map(({ entry, slot }, i) => (
              <FadeInView key={entry.channel.id} delay={40 + i * 40} offset={10}>
                <PressableScale
                  onPress={() => setActiveChannel(entry)}
                  style={[styles.liveCard, { backgroundColor: colors.surface, borderColor: `${entry.channel.color}88` }]}
                >
                  <View
                    pointerEvents="none"
                    style={[styles.liveCardGlow, { backgroundColor: `${entry.channel.color}1f` }]}
                  />
                  <View style={styles.liveCardTop}>
                    <ChannelBadge channel={entry.channel} size={38} />
                    <View style={styles.liveBadge}>
                      <LiveDot color="#ffffff" size={5} />
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  </View>
                  <Text style={[styles.liveChannel, { color: entry.channel.color }]} numberOfLines={1}>
                    {entry.channel.shortName}
                  </Text>
                  <Text style={[styles.liveShow, { color: colors.text }]} numberOfLines={2}>
                    {slot!.show}
                  </Text>
                  <Text style={[styles.liveTime, { color: colors.textDim }]}>
                    {slot!.start} – {slot!.end}
                  </Text>
                  <View style={[styles.liveProgressTrack, { backgroundColor: `${entry.channel.color}33` }]}>
                    <View
                      style={[
                        styles.liveProgressFill,
                        { width: `${Math.round(slotProgress(slot) * 100)}%`, backgroundColor: entry.channel.color },
                      ]}
                    />
                  </View>
                </PressableScale>
              </FadeInView>
            ))}
          </ScrollView>
        )}

        {/* Day selector */}
        <FadeInView delay={70}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d) => {
              const active = d === day;
              const isToday = d === getTodayDayName();
              const date = dateForDay(d);
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => {
                    if (d === day) return;
                    setLoading(true);
                    setDay(d);
                    load(d);
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: active ? tint : colors.surface,
                      borderColor: active ? tint : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.dayChipDate, { color: active ? '#0b0b10' : colors.textMuted }]}>
                    {date.getUTCDate()}
                  </Text>
                  <Text style={[styles.dayChipText, { color: active ? '#0b0b10' : colors.text }]}>
                    {d.slice(0, 3)}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayDot, { backgroundColor: active ? '#0b0b10' : tint }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </FadeInView>

        {/* Search */}
        <FadeInView delay={100}>
          <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.textDim, fontSize: 14 }}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a show or channel"
              placeholderTextColor={colors.textDim}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Text style={{ color: colors.textDim, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeInView>

        {/* Filter */}
        <FadeInView delay={120}>
          <View style={styles.filterRow}>
            {([
              { key: 'all', label: `All ${channels.length || ''}`.trim() },
              { key: 'tv', label: '📡 Linear TV' },
              { key: 'streaming', label: '🌐 Streaming' },
            ] as const).map((f) => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.filterChip,
                    { backgroundColor: active ? `${tint}22` : 'transparent', borderColor: active ? tint : colors.border },
                  ]}
                >
                  <Text style={[styles.filterText, { color: active ? tint : colors.textMuted }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

        {loading ? (
          <Skeleton colors={colors} />
        ) : error && channels.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>📡</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Guide unavailable</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: tint }]} onPress={() => load(day)}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 36 }}>🔎</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              Try another channel name or clear the search.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listHead}>
              <Text style={[styles.listHeadTitle, { color: colors.textMuted }]}>
                CHANNEL WALL · {visible.length}
              </Text>
              <Text style={[styles.listHeadHint, { color: colors.textDim }]}>Tap for the full day</Text>
            </View>
            <View style={styles.tileGrid}>
              {visible.map((entry, i) => {
                const slot = currentSlot(entry.schedule?.slots);
                const next = nextSlot(entry.schedule?.slots);
                const count = entry.schedule?.slots?.length || 0;
                const isStreaming = entry.channel.type !== 'tv';
                const brand = entry.channel.color;
                return (
                  <FadeInView
                    key={entry.channel.id}
                    delay={Math.min(i, 10) * 40}
                    offset={14}
                    style={styles.tileWrap}
                  >
                    <PressableScale
                      style={[
                        styles.tile,
                        {
                          backgroundColor: colors.surface,
                          borderColor: slot ? `${brand}99` : colors.border,
                        },
                      ]}
                      onPress={() => setActiveChannel(entry)}
                    >
                      <View
                        pointerEvents="none"
                        style={[styles.tileGlow, { backgroundColor: `${brand}18` }]}
                      />
                      <View style={styles.tileTop}>
                        <ChannelBadge channel={entry.channel} size={44} />
                        <View style={styles.tileBadges}>
                          {slot && (
                            <View style={styles.tileLivePill}>
                              <LiveDot color="#ffffff" size={4} />
                              <Text style={styles.tileLiveText}>LIVE</Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.typePill,
                              {
                                borderColor: isStreaming
                                  ? `${colors.secondary}88`
                                  : `${tint}88`,
                                backgroundColor: isStreaming
                                  ? `${colors.secondary}18`
                                  : `${tint}18`,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.typePillText,
                                { color: isStreaming ? colors.secondary : tint },
                              ]}
                            >
                              {isStreaming ? 'OTT' : 'TV'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={1}>
                        {entry.channel.name}
                      </Text>

                      {slot ? (
                        <>
                          <Text style={[styles.tileShow, { color: colors.text }]} numberOfLines={2}>
                            {slot.show}
                          </Text>
                          <Text style={[styles.tileTime, { color: colors.textDim }]}>
                            {slot.start} – {slot.end}
                          </Text>
                          <View style={[styles.progressTrack, { backgroundColor: `${brand}33` }]}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.round(slotProgress(slot) * 100)}%`,
                                  backgroundColor: brand,
                                },
                              ]}
                            />
                          </View>
                        </>
                      ) : (
                        <>
                          <Text
                            style={[styles.tileShow, { color: colors.textMuted }]}
                            numberOfLines={2}
                          >
                            {next
                              ? `Next · ${next.show}`
                              : count > 0
                                ? `${count} shows listed`
                                : 'No listings today'}
                          </Text>
                          <Text style={[styles.tileTime, { color: colors.textDim }]}>
                            {next ? next.start : entry.channel.dthNumbers || ' '}
                          </Text>
                        </>
                      )}

                      <View style={styles.tileFooter}>
                        <Text
                          style={[
                            styles.countTag,
                            { color: entry.source === 'fallback' ? colors.warning : colors.textDim },
                          ]}
                        >
                          {sourceLabel(entry)} · {count}
                        </Text>
                        <Text style={[styles.tileOpen, { color: brand }]}>Open ›</Text>
                      </View>
                    </PressableScale>
                  </FadeInView>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Channel sheet */}
      <Modal
        visible={!!activeChannel}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveChannel(null)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setActiveChannel(null)} />
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {activeChannel && (
              <>
                <View style={[styles.sheetGrabber, { backgroundColor: colors.border }]} />
                <View style={styles.sheetHead}>
                  <ChannelBadge channel={activeChannel.channel} size={56} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                      {activeChannel.channel.name}
                    </Text>
                    <Text style={[styles.sheetMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {activeChannel.schedule?.day} · {activeChannel.schedule?.slots?.length || 0} shows ·{' '}
                      {sourceLabel(activeChannel)}
                    </Text>
                    {!!activeChannel.channel.dthNumbers && (
                      <Text style={[styles.sheetMeta, { color: colors.textDim }]} numberOfLines={1}>
                        📡 {activeChannel.channel.dthNumbers}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setActiveChannel(null)} style={styles.closeBtn}>
                    <Text style={{ color: colors.textDim, fontSize: 20 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 430 }} showsVerticalScrollIndicator={false}>
                  {activeChannel.schedule?.slots?.length ? (
                    activeChannel.schedule.slots.map((slot, i) => {
                      const isNow = currentSlot(activeChannel.schedule!.slots) === slot;
                      return (
                        <View
                          key={`${slot.start}-${i}`}
                          style={[
                            styles.slotRow,
                            { borderColor: colors.border },
                            isNow && {
                              backgroundColor: `${activeChannel.channel.color}18`,
                              borderColor: activeChannel.channel.color,
                            },
                          ]}
                        >
                          <View style={[styles.slotRail, { backgroundColor: isNow ? activeChannel.channel.color : colors.border }]} />
                          <View style={styles.slotTime}>
                            <Text
                              style={[
                                styles.slotStart,
                                { color: isNow ? activeChannel.channel.color : colors.text },
                              ]}
                            >
                              {slot.start}
                            </Text>
                            <Text style={[styles.slotEnd, { color: colors.textDim }]}>{slot.end}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.slotShow, { color: colors.text }]}>{slot.show}</Text>
                            {!!slot.description && (
                              <Text style={[styles.slotDesc, { color: colors.textMuted }]} numberOfLines={2}>
                                {slot.description}
                              </Text>
                            )}
                          </View>
                          {isNow && (
                            <View style={[styles.nowPill, { backgroundColor: activeChannel.channel.color }]}>
                              <Text style={styles.nowPillText}>NOW</Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.emptySheet}>
                      <Text style={styles.emptyEmoji}>📡</Text>
                      <Text style={[styles.emptyTitle, { color: colors.text }]}>No listings for this day</Text>
                      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                        The live guide only carries today and tomorrow. Pick another day or refresh.
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.sheetBtnOutline, { borderColor: colors.border }]}
                  onPress={() => setActiveChannel(null)}
                >
                  <Text style={[styles.sheetBtnOutlineText, { color: colors.textMuted }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl ?? borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -60,
    top: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  heroLiveText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroDate: { fontSize: 11, fontWeight: '700' },
  heroTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  heroStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  heroStatValue: { fontSize: 18, fontWeight: '900' },
  heroStatLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, marginTop: 1 },
  liveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  liveHeadSpacer: { flex: 1 },
  liveLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  offlinePill: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offlinePillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  liveStrip: { paddingHorizontal: spacing.md, gap: 10, paddingBottom: spacing.md },
  liveCard: {
    width: 168,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 12,
    minHeight: 150,
    overflow: 'hidden',
  },
  liveCardGlow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60 },
  liveCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  liveChannel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  liveShow: { fontSize: 13, fontWeight: '800', marginTop: 3, lineHeight: 17 },
  liveTime: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  liveProgressTrack: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  liveProgressFill: { height: 3, borderRadius: 2 },
  dayRow: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: spacing.sm },
  dayChip: {
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayChipDate: { fontSize: 15, fontWeight: '900', lineHeight: 18 },
  dayChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: 1 },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '700' },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  listHeadTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  listHeadHint: { fontSize: 10 },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  tileWrap: { width: TILE_WIDTH },
  tile: {
    width: '100%',
    minHeight: 176,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 11,
    overflow: 'hidden',
  },
  tileGlow: {
    position: 'absolute',
    right: -34,
    top: -40,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  tileBadges: { alignItems: 'flex-end', gap: 5 },
  tileLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  tileLiveText: { color: '#fff', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  tileName: { fontSize: 13, fontWeight: '800', marginTop: 9 },
  tileShow: { fontSize: 11.5, lineHeight: 15, marginTop: 3, minHeight: 30 },
  tileTime: { fontSize: 9.5, fontWeight: '600', marginTop: 2 },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 7,
  },
  tileOpen: { fontSize: 9.5, fontWeight: '900' },
  grid: { paddingHorizontal: spacing.md, gap: 10 },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardWash: { position: 'absolute', left: 0, top: 0, right: 0, height: 70 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  channelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelName: { flex: 1, fontSize: 14, fontWeight: '800' },
  typePill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  typePillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  nowText: { fontSize: 11.5, marginTop: 4 },
  progressTrack: { height: 3, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  offlineTag: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  countTag: { fontSize: 9, fontWeight: '700' },
  dth: { fontSize: 9, flexShrink: 1 },
  chevron: { fontSize: 22, fontWeight: '300' },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  skeletonLogo: { width: 54, height: 54, borderRadius: 16 },
  center: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 30, gap: 8 },
  centerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 9, borderRadius: borderRadius.md },
  retryText: { color: '#0b0b10', fontSize: 12, fontWeight: '900' },
  webLink: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  webLinkText: { fontSize: 12, fontWeight: '800' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
    paddingBottom: 28,
  },
  sheetGrabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetMeta: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 6,
    overflow: 'hidden',
  },
  slotRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  slotTime: { width: 46 },
  slotStart: { fontSize: 13, fontWeight: '800' },
  slotEnd: { fontSize: 10 },
  slotShow: { fontSize: 13, fontWeight: '700' },
  slotDesc: { fontSize: 11, marginTop: 2 },
  nowPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  nowPillText: { color: '#0b0b10', fontSize: 8, fontWeight: '900' },
  emptySheet: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 34, marginBottom: 8 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  sheetBtn: { marginTop: spacing.md, borderRadius: borderRadius.md, paddingVertical: 13, alignItems: 'center' },
  sheetBtnText: { color: '#0b0b10', fontSize: 13, fontWeight: '900' },
  sheetBtnOutline: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetBtnOutlineText: { fontSize: 12, fontWeight: '800' },
});
