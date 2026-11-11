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
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { TvChannelEntry, TvTimeSlot } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';

const TV_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getTodayDayName() {
  return TV_DAYS[new Date().getDay()];
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
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

function LiveDot({ color }: { color: string }) {
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
    <View style={styles.liveDotWrap}>
      <Animated.View
        style={[
          styles.liveDotHalo,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View style={[styles.liveDot, { backgroundColor: color }]} />
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

function ChannelBadge({ channel, size = 48 }: { channel: any; size?: number }) {
  const [imgError, setImgError] = React.useState(false);
  const ch = channel || {};
  const logo = ch.logoUrl;
  const showImg = !!logo && !imgError;
  const brandColor = ch.color || '#3b82f6';
  const label = ch.shortName || ch.name || 'TV';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: '#121422',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${brandColor}55`,
        padding: 4,
      }}
    >
      {showImg ? (
        <Image
          source={{
            uri: logo,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
              Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          }}
          style={{ width: '92%', height: '92%' }}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: label.length > 5 ? 9 : 11,
              fontWeight: '900',
              letterSpacing: 0.5,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View style={{ width: 14, height: 2.5, borderRadius: 2, backgroundColor: brandColor, marginTop: 3 }} />
        </View>
      )}
    </View>
  );
}

export default function TVGuideScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDiwali } = useTheme();
  const tint = isDiwali ? '#f59e0b' : colors.primary;

  const [channels, setChannels] = useState<TvChannelEntry[]>([]);
  const [days, setDays] = useState<string[]>(TV_DAYS);
  const [day, setDay] = useState<string>(getTodayDayName());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<TvChannelEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'tv' | 'streaming'>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async (selectedDay?: string) => {
    try {
      setError(null);
      const base = await api.fun.tvSchedule(selectedDay);
      if (base?.channels?.length) {
        setChannels(base.channels);
        if (base.availableDays?.length) setDays(base.availableDays);
        if (base.day) setDay(base.day);
        setUpdatedAt(base.updatedAt || null);
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
  }, []);

  useEffect(() => {
    // Paint the last good grid immediately, then refresh underneath. The guide
    // is the slowest screen on a cold cache, so it must never block on network.
    let cancelled = false;
    (async () => {
      const cached = await api.fun.tvSchedulePeek();
      if (cancelled || !cached?.channels?.length) return;
      setChannels(cached.channels);
      if (cached.availableDays?.length) setDays(cached.availableDays);
      if (cached.day) setDay(cached.day);
      setUpdatedAt(cached.updatedAt || null);
      setLoading(false);
    })();
    load();
    return () => {
      cancelled = true;
    };
  }, [load]);

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
            ? `${totalSlots} airings · updated ${updatedLabel}`
            : 'Real listings from epg.pw & AniList'
        }
        emoji="📺"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
      >
        {/* Live now strip */}
        <FadeInView delay={30}>
          <View style={styles.liveHead}>
            <LiveDot color={liveNow.length ? '#ef4444' : tint} />
            <Text style={[styles.liveLabel, { color: liveNow.length ? '#ef4444' : colors.textMuted }]}>
              {liveNow.length ? `LIVE NOW · ${liveNow.length} CHANNELS` : 'NOTHING LIVE RIGHT NOW'}
            </Text>
          </View>
        </FadeInView>

        {liveNow.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveStrip}>
            {liveNow.map(({ entry, slot }, i) => (
              <FadeInView key={entry.channel.id} delay={50 + i * 40} offset={8}>
                <PressableScale
                  onPress={() => setActiveChannel(entry)}
                  style={[styles.liveCard, { backgroundColor: colors.surface, borderColor: `${entry.channel.color}66` }]}
                >
                  <View style={styles.liveCardTop}>
                    <ChannelBadge channel={entry.channel} size={26} />
                    <View style={[styles.liveBadge, { backgroundColor: '#ef4444' }]}>
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
                </PressableScale>
              </FadeInView>
            ))}
          </ScrollView>
        )}

        {/* Day selector */}
        <FadeInView delay={90}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d) => {
              const active = d === day;
              const isToday = d === getTodayDayName();
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => {
                    if (d === day) return;
                    setLoading(true);
                    setDay(d);
                    load(d);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.dayChip,
                    { backgroundColor: active ? tint : colors.surface, borderColor: active ? tint : colors.border },
                  ]}
                >
                  <Text style={[styles.dayChipText, { color: active ? '#0b0b10' : colors.textMuted }]}>
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
        <FadeInView delay={120}>
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
        <FadeInView delay={150}>
          <View style={styles.filterRow}>
            {([
              { key: 'all', label: 'All' },
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
          <View style={styles.grid}>
            {visible.map((entry, i) => {
              const slot = currentSlot(entry.schedule?.slots);
              const next = nextSlot(entry.schedule?.slots);
              const count = entry.schedule?.slots?.length || 0;
              return (
                <FadeInView key={entry.channel.id} delay={160 + Math.min(i, 10) * 30} offset={12}>
                  <PressableScale
                    style={[styles.channelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => setActiveChannel(entry)}
                  >
                    <View style={[styles.accent, { backgroundColor: entry.channel.color }]} />
                    <ChannelBadge channel={entry.channel} size={48} />

                    <View style={{ flex: 1 }}>
                      <View style={styles.channelTitleRow}>
                        <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
                          {entry.channel.name}
                        </Text>
                        <View
                          style={[
                            styles.typePill,
                            { borderColor: entry.channel.type === 'tv' ? `${tint}88` : `${colors.secondary}88` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typePillText,
                              { color: entry.channel.type === 'tv' ? tint : colors.secondary },
                            ]}
                          >
                            {entry.channel.type === 'tv' ? 'TV' : 'OTT'}
                          </Text>
                        </View>
                      </View>

                      {slot ? (
                        <Text style={[styles.nowText, { color: colors.textMuted }]} numberOfLines={1}>
                          <Text style={{ color: '#ef4444', fontWeight: '800' }}>● </Text>
                          {slot.show} · {slot.start}
                        </Text>
                      ) : next ? (
                        <Text style={[styles.nowText, { color: colors.textMuted }]} numberOfLines={1}>
                          Next {next.start} · {next.show}
                        </Text>
                      ) : (
                        <Text style={[styles.nowText, { color: colors.textDim }]} numberOfLines={1}>
                          {count > 0 ? `${count} shows listed` : 'No listings for this day'}
                        </Text>
                      )}

                      {!!entry.channel.dthNumbers && (
                        <Text style={[styles.dth, { color: colors.textDim }]} numberOfLines={1}>
                          📡 {entry.channel.dthNumbers}
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.chevron, { color: colors.textDim }]}>›</Text>
                  </PressableScale>
                </FadeInView>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.webLink, { borderColor: colors.border }]}
          onPress={() => navigation.navigate('Web', { title: 'TV Schedule', path: '/tv-schedule' })}
        >
          <Text style={[styles.webLinkText, { color: tint }]}>Open the full guide on zyverse.in →</Text>
        </TouchableOpacity>
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
                <View style={styles.sheetHead}>
                  <ChannelBadge channel={activeChannel.channel} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                      {activeChannel.channel.name}
                    </Text>
                    <Text style={[styles.sheetMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {activeChannel.schedule?.day} · {activeChannel.schedule?.slots?.length || 0} shows
                      {activeChannel.channel.dthNumbers ? ` · ${activeChannel.channel.dthNumbers}` : ''}
                    </Text>
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
                            isNow && { backgroundColor: `${tint}14`, borderColor: tint },
                          ]}
                        >
                          <View style={styles.slotTime}>
                            <Text style={[styles.slotStart, { color: isNow ? tint : colors.text }]}>{slot.start}</Text>
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
                            <View style={[styles.nowPill, { backgroundColor: tint }]}>
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
                        The EPG feed only carries today and tomorrow. Pick another day or refresh.
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: tint }]}
                  onPress={() => {
                    const channel = activeChannel;
                    setActiveChannel(null);
                    navigation.navigate('Web', {
                      title: channel.channel.name,
                      path: '/tv-schedule',
                    });
                  }}
                >
                  <Text style={styles.sheetBtnText}>Full channel guide →</Text>
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
  liveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotHalo: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  liveStrip: { paddingHorizontal: spacing.md, gap: 10, paddingBottom: spacing.md },
  liveCard: { width: 152, borderRadius: borderRadius.lg, borderWidth: 1, padding: 12, minHeight: 126 },
  liveCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  liveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  liveChannel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  liveShow: { fontSize: 13, fontWeight: '700', marginTop: 2, lineHeight: 17 },
  liveTime: { fontSize: 10, marginTop: 6 },
  dayRow: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: spacing.sm },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayChipText: { fontSize: 12, fontWeight: '800' },
  todayDot: { width: 5, height: 5, borderRadius: 3 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginVertical: spacing.md },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '700' },
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
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  channelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelName: { flex: 1, fontSize: 14, fontWeight: '800' },
  typePill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  typePillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  nowText: { fontSize: 11, marginTop: 3 },
  dth: { fontSize: 10, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '300' },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  skeletonLogo: { width: 48, height: 48, borderRadius: 14 },
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
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '900' },
  sheetMeta: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  slotTime: { width: 48 },
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
});
