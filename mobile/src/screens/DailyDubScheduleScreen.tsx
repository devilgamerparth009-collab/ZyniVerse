import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { LiveDubEntry, LiveDubSource, TvChannelEntry, TvTimeSlot } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';
import { cleanText, timeAgo } from '../utils/helpers';
import { openTrustedExternalUrl } from '../utils/safeLinks';
import ImageWithFallback from '../components/ImageWithFallback';
import { imageCandidates } from '../lib/avatar-src';
import { localChannelLogo } from '../utils/channelLogos';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const LANG_COLOR: Record<string, string> = {
  Hindi: '#ff9933',
  Tamil: '#e84a5f',
  Telugu: '#6c63ff',
  English: '#3b82f6',
  Japanese: '#a855f7',
  Kannada: '#22c55e',
  Malayalam: '#14b8a6',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Formats 24h IST clock minutes as "4:30 PM". */
function clockLabel(hours: number, minutes: number): string {
  const h = hours % 12 || 12;
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${h}:${pad(minutes)} ${suffix}`;
}

interface IstParts {
  dayName: string;
  dayShort: string;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  minutes: number;
  sortMs: number;
}

/** Converts any ISO timestamp into IST parts without relying on Intl timezone. */
function istParts(iso: string): IstParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  return {
    dayName: DAY_NAMES[ist.getUTCDay()],
    dayShort: DAY_SHORT[ist.getUTCDay()],
    dateKey: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
    dateLabel: `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`,
    timeLabel: clockLabel(hours, minutes),
    minutes: hours * 60 + minutes,
    sortMs: d.getTime(),
  };
}

function istToday(): { dayName: string; dayShort: string; dateKey: string } {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const idx = ist.getUTCDay();
  return {
    dayName: DAY_NAMES[idx],
    dayShort: DAY_SHORT[idx],
    dateKey: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
  };
}

function nowIstMinutes(): number {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Pulls an 11-char YouTube id out of any URL/thumbnail shape the API returns. */
function youtubeId(entry: LiveDubEntry): string | null {
  if (entry.videoId && entry.videoId.length === 11) return entry.videoId;
  const patterns = [/\/vi\/([\w-]{11})\//, /[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/];
  const haystack = `${entry.thumbnail || ''} ${entry.url || ''}`;
  for (const re of patterns) {
    const m = haystack.match(re);
    if (m) return m[1];
  }
  return null;
}

function thumbUrl(entry: LiveDubEntry): string | null {
  const id = youtubeId(entry);
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (entry.thumbnail && /^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(entry.thumbnail)) {
    return entry.thumbnail;
  }
  return null;
}

function episodeNumber(title: string): string | null {
  const m = title.match(/episode\s*[-–]?\s*(\d+)/i) || title.match(/\bep\s*[-.]?\s*(\d+)/i);
  return m ? `EP ${m[1]}` : null;
}

/** Removes the [Hindi Dub] / ⟪…⟫ noise from upload titles. */
function prettyTitle(title: string): string {
  return cleanText(
    title
      .replace(/[⟪⟫]/g, '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\((?:s\d+e\d+)\)/gi, ' ')
      .replace(/\b(?:hindi|tamil|telugu|kannada|malayalam)\s*dub\b/gi, ' ')
      .replace(/\|\s*muse\s*(?:in|india)\b/gi, ' ')
      .replace(/\bani-?one(?:\s+india)?\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*[-–]\s*$/, '')
      .trim()
  );
}

function slotIsNow(slot: TvTimeSlot, nowMin: number): boolean {
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  if (start > end) return nowMin >= start || nowMin < end;
  return nowMin >= start && nowMin < end;
}

function ChannelBadge({ channel, size = 44 }: { channel: any; size?: number }) {
  const [failed, setFailed] = useState(false);
  const brand = channel?.color || '#3b82f6';
  const label = channel?.shortName || channel?.name || 'TV';
  const bundledLogo = localChannelLogo(channel?.id);
  const logoCandidates = imageCandidates(channel?.logoUrl);
  useEffect(() => { setFailed(false); }, [channel?.id, channel?.logoUrl]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: '#121422',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${brand}55`,
        padding: 4,
      }}
    >
      {bundledLogo ? (
        <Image
          source={bundledLogo}
          style={{ width: '92%', height: '92%' }}
          resizeMode="contain"
        />
      ) : logoCandidates.length > 0 && !failed ? (
        <ImageWithFallback
          sources={logoCandidates}
          style={{ width: '92%', height: '92%' }}
          resizeMode="contain"
          onGiveUp={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{ color: '#fff', fontSize: label.length > 5 ? 8 : 10, fontWeight: '900', textAlign: 'center' }}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

function Skeleton({ colors }: { colors: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.9, 0.45] });

  return (
    <View style={{ padding: spacing.md, gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]}
        >
          <View style={[styles.thumbWrap, { backgroundColor: colors.surfaceLight || colors.border }]} />
          <View style={{ flex: 1, gap: 9, paddingVertical: 6 }}>
            <View style={{ height: 11, width: '85%', borderRadius: 5, backgroundColor: colors.surfaceLight || colors.border }} />
            <View style={{ height: 9, width: '60%', borderRadius: 5, backgroundColor: colors.surfaceLight || colors.border }} />
            <View style={{ height: 9, width: '40%', borderRadius: 5, backgroundColor: colors.surfaceLight || colors.border }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

type DropItem = {
  key: string;
  entry: LiveDubEntry;
  sourceName: string;
  ist: IstParts;
};

export default function DailyDubScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();
  const tint = isLaunch ? '#22d3ee' : colors.primary;

  const today = useMemo(istToday, []);

  const [tab, setTab] = useState<'drops' | 'tv'>('drops');
  const [sources, setSources] = useState<LiveDubSource[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [tvChannels, setTvChannels] = useState<TvChannelEntry[]>([]);
  const [tvDay, setTvDay] = useState<string>(today.dayName);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string>('Today');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedLang, setSelectedLang] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [tvLoading, setTvLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tvError, setTvError] = useState<string | null>(null);

  const loadDrops = useCallback(async () => {
    try {
      const data = await api.fun.liveDubs();
      setSources((data?.sources || []).filter((s) => s.ok && s.entries?.length));
      setFetchedAt(data?.fetchedAt || null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load the dub schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTv = useCallback(async (day: string) => {
    setTvLoading(true);
    try {
      const data = await api.fun.tvSchedule(day);
      const linear = (data?.channels || []).filter(
        (c) => c.channel?.type === 'tv' && (c.schedule?.slots?.length || 0) > 0
      );
      setTvChannels(linear);
      setTvError(null);
      setActiveChannelId((prev) => {
        if (prev && linear.some((c) => c.channel.id === prev)) return prev;
        return linear[0]?.channel.id || null;
      });
    } catch (e: any) {
      setTvChannels([]);
      setTvError(e?.message || 'Could not load TV airings.');
    } finally {
      setTvLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrops();
  }, [loadDrops]);

  useEffect(() => {
    loadTv(today.dayName);
  }, [loadTv, today.dayName]);

  const drops = useMemo<DropItem[]>(() => {
    const out: DropItem[] = [];
    for (const source of sources) {
      for (const entry of source.entries) {
        const ist = istParts(entry.published);
        if (!ist) continue;
        out.push({
          key: `${source.id}-${entry.videoId || entry.url}`,
          entry,
          sourceName: source.name,
          ist,
        });
      }
    }
    return out.sort((a, b) => b.ist.sortMs - a.ist.sortMs);
  }, [sources]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    drops.forEach((d) => d.entry.language && set.add(d.entry.language));
    return Array.from(set);
  }, [drops]);

  const dayCounts = useMemo(() => {
    const map: Record<string, number> = {};
    drops.forEach((d) => {
      map[d.ist.dayName] = (map[d.ist.dayName] || 0) + 1;
    });
    return map;
  }, [drops]);

  const filteredDrops = useMemo(() => {
    return drops.filter((d) => {
      const dayOk = selectedDay === 'All' || d.ist.dayName === selectedDay;
      const sourceOk = selectedSource === 'all' || d.sourceName === selectedSource;
      const langOk = selectedLang === 'all' || d.entry.language === selectedLang;
      return dayOk && sourceOk && langOk;
    });
  }, [drops, selectedDay, selectedSource, selectedLang]);

  const groupedDrops = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; dayName: string; items: DropItem[] }[] = [];
    for (const item of filteredDrops) {
      let group = groups.find((g) => g.dateKey === item.ist.dateKey);
      if (!group) {
        group = {
          dateKey: item.ist.dateKey,
          dateLabel: item.ist.dateLabel,
          dayName: item.ist.dayName,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [filteredDrops]);

  const activeChannel = useMemo(
    () => tvChannels.find((c) => c.channel.id === activeChannelId) || null,
    [tvChannels, activeChannelId]
  );

  const nowMin = useMemo(nowIstMinutes, []);
  const liveCount = useMemo(
    () =>
      tvChannels.filter((c) =>
        (c.schedule?.slots || []).some((slot) => slotIsNow(slot, nowMin))
      ).length,
    [tvChannels, nowMin]
  );

  const totalDrops = drops.length;
  const weekDays = useMemo(() => {
    const idx = DAY_NAMES.indexOf(today.dayName);
    return Array.from({ length: 7 }, (_, i) => DAY_NAMES[(idx + i) % 7]);
  }, [today.dayName]);

  const openEntry = async (entry: LiveDubEntry) => {
    const opened = await openTrustedExternalUrl(entry.url);
    if (opened) return;
    Alert.alert('Watch link', 'An official watch link is not available for this episode yet.');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDrops(), tab === 'tv' ? loadTv(tvDay) : Promise.resolve()]);
    setRefreshing(false);
  };

  const subtitle = fetchedAt
    ? `${totalDrops} real uploads · synced ${timeAgo(fetchedAt)}`
    : 'Real Hindi, Tamil & Telugu dub uploads';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Daily Dub Schedule" subtitle={subtitle} emoji="📅" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
      >
        {/* Hero */}
        <FadeInView delay={30}>
          <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.heroGlow, { backgroundColor: `${tint}22` }]} />
            <Text style={styles.heroEmoji}>🇮🇳</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>India Dub Release Tracker</Text>
              <Text style={[styles.heroText, { color: colors.textMuted }]}>
                Every row is a real upload or TV airing with live timings. Unannounced slots are
                shown as TBA instead of invented times.
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* Tabs */}
        <FadeInView delay={50}>
          <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(
              [
                { key: 'drops', label: `📥 New drops${totalDrops ? ` (${totalDrops})` : ''}` },
                { key: 'tv', label: `📺 On TV${liveCount ? ` · ${liveCount} live` : ''}` },
              ] as const
            ).map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.85}
                  style={[
                    styles.tabBtn,
                    active && { backgroundColor: `${tint}22`, borderColor: tint },
                  ]}
                >
                  <Text style={[styles.tabText, { color: active ? tint : colors.textMuted }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeInView>

        {tab === 'drops' ? (
          <>
            {/* Week strip */}
            <FadeInView delay={70}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  onPress={() => setSelectedDay('Today')}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: selectedDay === 'Today' ? tint : colors.surface,
                      borderColor: selectedDay === 'Today' ? tint : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.dayChipText, { color: selectedDay === 'Today' ? '#0b0b10' : colors.textMuted }]}>
                    Today · {today.dayShort}
                  </Text>
                  <View style={[styles.countDot, { backgroundColor: selectedDay === 'Today' ? '#0b0b10' : tint }]}>
                    <Text style={[styles.countDotText, { color: selectedDay === 'Today' ? tint : '#0b0b10' }]}>
                      {dayCounts[today.dayName] || 0}
                    </Text>
                  </View>
                </TouchableOpacity>

                {weekDays.map((d) => {
                  if (d === today.dayName) return null;
                  const active = selectedDay === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setSelectedDay(d)}
                      style={[
                        styles.dayChip,
                        { backgroundColor: active ? tint : colors.surface, borderColor: active ? tint : colors.border },
                      ]}
                    >
                      <Text style={[styles.dayChipText, { color: active ? '#0b0b10' : colors.textMuted }]}>
                        {DAY_SHORT[DAY_NAMES.indexOf(d)]}
                      </Text>
                      <View style={[styles.countDot, { backgroundColor: active ? '#0b0b10' : `${tint}22` }]}>
                        <Text style={[styles.countDotText, { color: active ? tint : tint }]}>{dayCounts[d] || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setSelectedDay('All')}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: selectedDay === 'All' ? tint : colors.surface,
                      borderColor: selectedDay === 'All' ? tint : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.dayChipText, { color: selectedDay === 'All' ? '#0b0b10' : colors.textMuted }]}>
                    All
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </FadeInView>

            {/* Language filters */}
            {languages.length > 0 && (
              <FadeInView delay={110}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <TouchableOpacity
                    onPress={() => setSelectedLang('all')}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: selectedLang === 'all' ? tint : colors.border,
                        backgroundColor: selectedLang === 'all' ? `${tint}18` : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.filterText, { color: selectedLang === 'all' ? tint : colors.textMuted }]}>
                      All dubs
                    </Text>
                  </TouchableOpacity>
                  {languages.map((lang) => {
                    const color = LANG_COLOR[lang] || tint;
                    const active = selectedLang === lang;
                    return (
                      <TouchableOpacity
                        key={lang}
                        onPress={() => setSelectedLang(lang)}
                        style={[
                          styles.filterChip,
                          {
                            borderColor: active ? color : colors.border,
                            backgroundColor: active ? `${color}18` : 'transparent',
                          },
                        ]}
                      >
                        <Text style={[styles.filterText, { color: active ? color : colors.textMuted }]}>
                          {lang} dub
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </FadeInView>
            )}

            {loading ? (
              <Skeleton colors={colors} />
            ) : error ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 40 }}>📡</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Schedule unavailable</Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>{error}</Text>
                <TouchableOpacity style={[styles.cta, { backgroundColor: tint }]} onPress={() => { setLoading(true); loadDrops(); }}>
                  <Text style={styles.ctaText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : filteredDrops.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 38 }}>🗓️</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {selectedDay === 'Today' ? 'No drops today yet' : 'No uploads for this filter'}
                </Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>
                  New episodes are published on a rolling schedule. Try “All” to see every upload
                  from the past week.
                </Text>
                <TouchableOpacity style={[styles.ghostCta, { borderColor: colors.border }]} onPress={() => { setSelectedDay('All'); setSelectedSource('all'); setSelectedLang('all'); }}>
                  <Text style={[styles.ghostCtaText, { color: colors.textMuted }]}>Show all uploads</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ paddingTop: spacing.sm }}>
                {groupedDrops.map((group, gi) => (
                  <View key={group.dateKey}>
                    <View style={styles.groupHead}>
                      <Text style={[styles.groupTitle, { color: colors.text }]}>
                        {group.dayName}
                        {group.dateKey === today.dateKey ? ' · Today' : ''}
                      </Text>
                      <Text style={[styles.groupMeta, { color: colors.textDim }]}>
                        {group.dateLabel} · {group.items.length} {group.items.length === 1 ? 'drop' : 'drops'}
                      </Text>
                    </View>

                    {group.items.map((item, i) => {
                      const color = LANG_COLOR[item.entry.language] || tint;
                      const ep = episodeNumber(item.entry.title);
                      return (
                        <FadeInView key={item.key} delay={40 + Math.min(gi * 3 + i, 10) * 25} offset={10}>
                          <PressableScale
                            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => openEntry(item.entry)}
                          >
                            <View style={styles.thumbWrap}>
                              <Image
                                source={{ uri: thumbUrl(item.entry) || '' }}
                                style={styles.thumb}
                                resizeMode="cover"
                              />
                              <View style={styles.playBadge}>
                                <Text style={styles.playIcon}>▶</Text>
                              </View>
                              <View style={[styles.langBadge, { backgroundColor: color }]}>
                                <Text style={styles.langBadgeText}>{item.entry.language}</Text>
                              </View>
                            </View>

                            <View style={{ flex: 1, paddingVertical: 2 }}>
                              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                                {prettyTitle(item.entry.title)}
                              </Text>
                              <Text style={[styles.cardMeta, { color: colors.textDim }]} numberOfLines={1}>
                                {item.ist.timeLabel} IST
                              </Text>
                              <View style={styles.cardBottom}>
                                {ep ? (
                                  <View style={[styles.epPill, { borderColor: `${color}88`, backgroundColor: `${color}14` }]}>
                                    <Text style={[styles.epText, { color }]}>{ep}</Text>
                                  </View>
                                ) : (
                                  <View style={[styles.epPill, { borderColor: colors.border }]}>
                                    <Text style={[styles.epText, { color: colors.textMuted }]}>
                                      {item.entry.language} dub
                                    </Text>
                                  </View>
                                )}
                                <Text style={[styles.watchText, { color: tint }]}>Watch →</Text>
                              </View>
                            </View>
                          </PressableScale>
                        </FadeInView>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* On TV */}
            <FadeInView delay={70}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {[today.dayName, DAY_NAMES[(DAY_NAMES.indexOf(today.dayName) + 1) % 7]].map((d) => {
                  const active = tvDay === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => {
                        if (tvDay === d) return;
                        setTvDay(d);
                        loadTv(d);
                      }}
                      style={[
                        styles.dayChip,
                        { backgroundColor: active ? tint : colors.surface, borderColor: active ? tint : colors.border },
                      ]}
                    >
                      <Text style={[styles.dayChipText, { color: active ? '#0b0b10' : colors.textMuted }]}>
                        {d === today.dayName ? `Today · ${today.dayShort}` : `Tomorrow · ${DAY_SHORT[DAY_NAMES.indexOf(d)]}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </FadeInView>

            {tvLoading ? (
              <Skeleton colors={colors} />
            ) : tvError || tvChannels.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 38 }}>📺</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No TV airings for this day</Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>
                  {tvError || 'The live guide only carries today and tomorrow. Try the other day or refresh.'}
                </Text>
                <TouchableOpacity style={[styles.cta, { backgroundColor: tint }]} onPress={() => loadTv(tvDay)}>
                  <Text style={styles.ctaText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FadeInView delay={90}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {tvChannels.map((c) => {
                      const active = c.channel.id === activeChannelId;
                      const isLive = (c.schedule?.slots || []).some((s) => slotIsNow(s, nowMin));
                      return (
                        <TouchableOpacity
                          key={c.channel.id}
                          onPress={() => setActiveChannelId(c.channel.id)}
                          style={[
                            styles.channelChip,
                            {
                              backgroundColor: active ? `${c.channel.color}22` : colors.surface,
                              borderColor: active ? c.channel.color : colors.border,
                            },
                          ]}
                        >
                          <ChannelBadge channel={c.channel} size={26} />
                          {isLive && <View style={styles.liveDotSmall} />}
                          <Text
                            style={[styles.channelChipText, { color: active ? c.channel.color : colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {c.channel.shortName || c.channel.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </FadeInView>

                {activeChannel && (
                  <FadeInView delay={110}>
                    <View style={[styles.tvCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={[styles.tvAccent, { backgroundColor: activeChannel.channel.color }]} />
                      <View style={styles.tvHead}>
                        <ChannelBadge channel={activeChannel.channel} size={48} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.tvName, { color: colors.text }]} numberOfLines={1}>
                            {activeChannel.channel.name}
                          </Text>
                          <Text style={[styles.tvMeta, { color: colors.textMuted }]} numberOfLines={1}>
                            {activeChannel.schedule?.day} · {activeChannel.schedule?.slots?.length || 0} shows
                            {activeChannel.channel.dthNumbers ? ` · ${activeChannel.channel.dthNumbers}` : ''}
                          </Text>
                        </View>
                      </View>

                      {(activeChannel.schedule?.slots || []).map((slot, i) => {
                        const isNow = slotIsNow(slot, nowMin);
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
                              <Text style={[styles.slotShow, { color: colors.text }]} numberOfLines={1}>
                                {cleanText(slot.show)}
                              </Text>
                              {!!slot.description && (
                                <Text style={[styles.slotDesc, { color: colors.textMuted }]} numberOfLines={1}>
                                  {cleanText(slot.description)}
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
                      })}
                    </View>
                  </FadeInView>
                )}
              </>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.webLink, { borderColor: colors.border }]}
          onPress={() => navigation.navigate('HindiDub', { tab: 'schedule' })}
        >
          <Text style={[styles.webLinkText, { color: tint }]}>Open full week schedule</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -60, top: -80 },
  heroEmoji: { fontSize: 30 },
  heroTitle: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  heroText: { fontSize: 12, lineHeight: 17 },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: 4,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '800' },
  chipRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 8 },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  dayChipText: { fontSize: 12, fontWeight: '800' },
  countDot: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countDotText: { fontSize: 9, fontWeight: '900' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '700' },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: 170,
  },
  channelChipText: { fontSize: 11, fontWeight: '800' },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  groupTitle: { fontSize: 14, fontWeight: '900' },
  groupMeta: { fontSize: 10, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 10,
    gap: 12,
  },
  thumbWrap: { width: 112, height: 76, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: '#0a0b12' },
  thumb: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 9, marginLeft: 1 },
  langBadge: { position: 'absolute', bottom: 5, right: 5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  langBadgeText: { color: '#0b0b10', fontSize: 9, fontWeight: '900' },
  cardTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  cardMeta: { fontSize: 10, marginTop: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  epPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  epText: { fontSize: 9, fontWeight: '900' },
  watchText: { fontSize: 11, fontWeight: '800' },
  tvCard: {
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
  },
  tvAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  tvHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  tvName: { fontSize: 16, fontWeight: '900' },
  tvMeta: { fontSize: 11, marginTop: 2 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  slotTime: { width: 46 },
  slotStart: { fontSize: 13, fontWeight: '800' },
  slotEnd: { fontSize: 10 },
  slotShow: { fontSize: 13, fontWeight: '700' },
  slotDesc: { fontSize: 10, marginTop: 2 },
  nowPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  nowPillText: { color: '#0b0b10', fontSize: 8, fontWeight: '900' },
  center: { alignItems: 'center', paddingVertical: 54, paddingHorizontal: 30, gap: 8 },
  centerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  cta: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 9, borderRadius: borderRadius.md },
  ctaText: { color: '#0b0b10', fontSize: 12, fontWeight: '900' },
  ghostCta: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.md, borderWidth: 1 },
  ghostCtaText: { fontSize: 12, fontWeight: '700' },
  webLink: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  webLinkText: { fontSize: 12, fontWeight: '800' },
});
