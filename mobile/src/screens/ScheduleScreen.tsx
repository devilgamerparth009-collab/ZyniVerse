import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { formatAirDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import AdBanner from '../components/AdBanner';
import { api } from '../services/api';
import { ScheduleItem } from '../types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Other places to catch up with airing and dubbed anime. */
const EXPLORE_ITEMS: {
  key: string;
  icon: string;
  label: string;
  sub: string;
  tint: string;
  route: string;
  params?: Record<string, any>;
}[] = [
  { key: 'tv', icon: '📺', label: 'Live TV Guide', sub: 'Channels and streaming times', tint: '#ef4444', route: 'TVGuide' },
  { key: 'dubhub', icon: '🎬', label: 'Dub Hub Schedule', sub: 'Dubbed series and movies', tint: '#ff9933', route: 'HindiDub', params: { tab: 'schedule' } },
  { key: 'daily', icon: '🗓️', label: 'Daily Dub Schedule', sub: "Today's dubbed episodes", tint: '#60a5fa', route: 'DailyDubSchedule' },
];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function countdown(airingAt: string): { label: string; isLive: boolean; isPast: boolean } {
  const diff = new Date(airingAt).getTime() - Date.now();
  if (diff <= -3600000) return { label: 'Aired', isLive: false, isPast: true };
  if (diff <= 0) return { label: 'Airing Now', isLive: true, isPast: false };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { label: `in ${mins}m`, isLive: false, isPast: false };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `in ${hrs}h ${mins % 60}m`, isLive: false, isPast: false };
  return { label: `in ${Math.floor(hrs / 24)}d ${hrs % 24}h`, isLive: false, isPast: false };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(dayKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setError(null);
      const data = await api.schedule.get();
      setSchedule(data);
    } catch (e: any) {
      setError(e?.message || 'Could not load the airing schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedule();
  };

  const days = useMemo(() => {
    const list: { key: string; date: Date; label: string; dayNum: string; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push({
        key: dayKey(d),
        date: d,
        label: DAY_LABELS[d.getDay()],
        dayNum: String(d.getDate()),
        isToday: i === 0,
      });
    }
    return list;
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of schedule) {
      if (!item.airingAt) continue;
      const key = dayKey(new Date(item.airingAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.airingAt).getTime() - new Date(b.airingAt).getTime());
    }
    return map;
  }, [schedule]);

  const dayItems = grouped.get(selectedKey) || [];
  const selectedDay = days.find((d) => d.key === selectedKey) || days[0];

  const primaryColor = isDiwali ? '#FF8C00' : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Banner Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <FadeInView duration={360}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.statusPillText}>SIMULCAST AIRING TIMETABLE</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Release Calendar</Text>
          </FadeInView>
          <TouchableOpacity
            style={[styles.refreshIconBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={onRefresh}
          >
            <Text style={{ fontSize: 16 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* 7-Day Horizontal Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarStrip}
        >
          {days.map((d) => {
            const active = d.key === selectedKey;
            const count = (grouped.get(d.key) || []).length;

            return (
              <TouchableOpacity
                key={d.key}
                style={[
                  styles.dayCard,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  active && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                onPress={() => setSelectedKey(d.key)}
                activeOpacity={0.7}
              >
                {d.isToday && (
                  <Text style={[styles.todayBadge, { color: active ? '#ffffff' : primaryColor }]}>
                    TODAY
                  </Text>
                )}
                <Text
                  style={[
                    styles.dayLabel,
                    { color: active ? '#ffffff' : colors.textMuted },
                  ]}
                >
                  {d.label}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    { color: active ? '#ffffff' : colors.text },
                  ]}
                >
                  {d.dayNum}
                </Text>

                {count > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        { color: active ? '#ffffff' : colors.textDim },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingTop: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section Heading */}
        <FadeInView delay={60} style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            {selectedDay.isToday ? 'Airing Today' : `${selectedDay.label}, ${selectedDay.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
          </Text>
          <Text style={[styles.epCount, { color: colors.textMuted }]}>
            {dayItems.length} Episodes Scheduled
          </Text>
        </FadeInView>

        {/* Explore this feature */}
        <FadeInView delay={90} style={styles.exploreSection}>
          <Text style={[styles.exploreTitle, { color: primaryColor }]}>EXPLORE THIS FEATURE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exploreRow}
          >
            {EXPLORE_ITEMS.map((item) => (
              <PressableScale
                key={item.key}
                accessibilityLabel={`Explore ${item.label}`}
                onPress={() => navigation.navigate(item.route, item.params)}
                style={[
                  styles.exploreCard,
                  { backgroundColor: colors.surface, borderColor: `${item.tint}55` },
                ]}
              >
                <View style={[styles.exploreIcon, { backgroundColor: `${item.tint}22` }]}>
                  <Text style={styles.exploreEmoji}>{item.icon}</Text>
                </View>
                <View style={styles.exploreCopy}>
                  <Text style={[styles.exploreLabel, { color: colors.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={[styles.exploreSub, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.sub}
                  </Text>
                </View>
                <Text style={[styles.exploreArrow, { color: primaryColor }]}>›</Text>
              </PressableScale>
            ))}
          </ScrollView>
        </FadeInView>

        {/* Adsterra Sponsored Ad */}
        <FadeInView delay={110}>
          <AdBanner placement="schedule-header" />
        </FadeInView>

        {/* Schedule Items List */}
        {loading && dayItems.length === 0 ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : error && dayItems.length === 0 ? (
          <ErrorView message={error} onRetry={fetchSchedule} />
        ) : dayItems.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 44, marginBottom: 8 }}>📅</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No episodes scheduled for {selectedDay.label}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Check another day of the week to view upcoming broadcasts.
            </Text>
          </View>
        ) : (
          dayItems.map((item, idx) => {
            const timeStr = item.airingAt ? formatTime(item.airingAt) : '';
            const status = item.airingAt ? countdown(item.airingAt) : { label: '', isLive: false, isPast: false };
            const poster = item.media?.coverImage?.large || item.media?.coverImage?.medium;
            const animeTitle = item.media?.title?.english || item.media?.title?.romaji || item.title;

            return (
              <FadeInView
                key={`${item.mediaId}-${item.episode}-${idx}`}
                delay={Math.min(140 + (idx % 10) * 35, 450)}
                duration={320}
                offset={10}
              >
              <TouchableOpacity
                style={[
                  styles.itemCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (item.mediaId) {
                    navigation.navigate('AnimeDetail', { id: item.mediaId });
                  }
                }}
              >
                {/* Anime Cover */}
                <View style={styles.posterBox}>
                  {poster ? (
                    <Image source={{ uri: poster }} style={styles.poster} />
                  ) : (
                    <View style={[styles.posterFallback, { backgroundColor: colors.background }]}>
                      <Text style={{ fontSize: 24 }}>🎬</Text>
                    </View>
                  )}
                  {item.episode && (
                    <View style={[styles.epBadge, { backgroundColor: primaryColor }]}>
                      <Text style={styles.epBadgeText}>EP {item.episode}</Text>
                    </View>
                  )}
                </View>

                {/* Details */}
                <View style={styles.detailsCol}>
                  <View style={styles.timeRow}>
                    <Text style={[styles.airTime, { color: colors.textMuted }]}>
                      ⏰ {timeStr}
                    </Text>
                    <View
                      style={[
                        styles.countdownBadge,
                        status.isLive && { backgroundColor: '#ef4444' },
                        status.isPast && { backgroundColor: 'rgba(255,255,255,0.08)' },
                        !status.isLive && !status.isPast && { backgroundColor: primaryColor },
                      ]}
                    >
                      <Text style={styles.countdownText}>
                        {status.isLive ? '🔴 ' : ''}
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.animeName, { color: colors.text }]} numberOfLines={2}>
                    {animeTitle}
                  </Text>

                  {item.media?.format && (
                    <View style={styles.formatRow}>
                      <Text style={[styles.formatTag, { color: colors.textDim }]}>
                        {item.media.format}
                      </Text>
                      {item.media?.averageScore && (
                        <Text style={[styles.formatTag, { color: '#f59e0b' }]}>
                          ★ {item.media.averageScore / 10}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              </FadeInView>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    color: '#22c55e',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  calendarStrip: {
    gap: 8,
  },
  dayCard: {
    width: 58,
    height: 74,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 6,
  },
  todayBadge: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },
  countBadge: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  epCount: {
    fontSize: 12,
  },
  exploreSection: {
    marginTop: 6,
    marginBottom: 10,
  },
  exploreTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  exploreRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  exploreCard: {
    width: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  exploreIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreEmoji: { fontSize: 19 },
  exploreCopy: { flex: 1 },
  exploreLabel: { fontSize: 13, fontWeight: '800' },
  exploreSub: { fontSize: 10, marginTop: 2, lineHeight: 14 },
  exploreArrow: { fontSize: 20, fontWeight: '700' },
  itemCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    elevation: 2,
    gap: 12,
  },
  posterBox: {
    width: 66,
    height: 92,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  epBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
  },
  epBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  detailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  airTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  countdownBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countdownText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  animeName: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginBottom: 6,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 28,
    borderRadius: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
});
