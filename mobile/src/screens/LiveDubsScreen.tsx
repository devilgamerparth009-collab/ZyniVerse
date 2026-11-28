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
import { LiveDubEntry, LiveDubSource } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';
import { timeAgo, cleanText } from '../utils/helpers';
import { openTrustedExternalUrl } from '../utils/safeLinks';

const LANG_COLOR: Record<string, string> = {
  Hindi: '#ff9933',
  Tamil: '#e84a5f',
  Telugu: '#6c63ff',
  English: '#3b82f6',
  Japanese: '#a855f7',
};

function episodeNumber(title: string): string | null {
  const m = title.match(/episode\s*(\d+)/i) || title.match(/ep\s*(\d+)/i);
  return m ? `EP ${m[1]}` : null;
}

/** Pulls an 11-char YouTube id out of any of the URL shapes the API returns. */
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

/** Server thumbnails use `youtube.com/v/<id>?version=3`, which is not an image. */
function thumbUrl(entry: LiveDubEntry): string | null {
  const id = youtubeId(entry);
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (entry.thumbnail && /^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(entry.thumbnail)) {
    return entry.thumbnail;
  }
  return null;
}

function Thumb({ entry, color }: { entry: LiveDubEntry; color: string }) {
  const [failed, setFailed] = useState(false);
  const uri = thumbUrl(entry);
  return (
    <View style={styles.thumbWrap}>
      {uri && !failed ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: `${color}22` }]}>
          <Text style={{ fontSize: 22 }}>🎙️</Text>
        </View>
      )}
      <View style={styles.playBadge}>
        <Text style={styles.playIcon}>▶</Text>
      </View>
      <View style={[styles.langBadge, { backgroundColor: color }]}>
        <Text style={styles.langBadgeText}>{entry.language}</Text>
      </View>
    </View>
  );
}

function SkeletonCard({ colors }: { colors: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.9, 0.45] }),
        },
      ]}
    >
      <View style={[styles.thumbWrap, { backgroundColor: colors.surfaceLight || colors.border }]} />
      <View style={{ flex: 1, gap: 8, paddingVertical: 4 }}>
        <View style={{ height: 11, width: '90%', borderRadius: 5, backgroundColor: colors.surfaceLight || colors.border }} />
        <View style={{ height: 9, width: '55%', borderRadius: 5, backgroundColor: colors.surfaceLight || colors.border }} />
      </View>
    </Animated.View>
  );
}

export default function LiveDubsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();
  const tint = isLaunch ? '#22d3ee' : colors.primary;

  const [sources, setSources] = useState<LiveDubSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSource, setActiveSource] = useState<string>('all');
  const [language, setLanguage] = useState<string>('all');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.fun.liveDubs();
      const live = (data?.sources || []).filter((s) => s.ok && s.entries?.length);
      setSources(live);
      setFetchedAt(data?.fetchedAt || null);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo(() => {
    const pool =
      activeSource === 'all'
        ? sources.flatMap((s) => s.entries.map((e) => ({ ...e, sourceName: s.name })))
        : (sources.find((s) => s.id === activeSource)?.entries || []).map((e) => ({
            ...e,
            sourceName: sources.find((s) => s.id === activeSource)?.name || '',
          }));
    const filtered = language === 'all' ? pool : pool.filter((e) => e.language === language);
    return filtered.sort((a, b) => +new Date(b.published) - +new Date(a.published));
  }, [sources, activeSource, language]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    sources.forEach((s) => s.entries.forEach((e) => set.add(e.language)));
    return Array.from(set);
  }, [sources]);

  const total = useMemo(() => sources.reduce((acc, s) => acc + s.entries.length, 0), [sources]);

  const openEntry = async (entry: LiveDubEntry) => {
    const opened = await openTrustedExternalUrl(entry.url);
    if (opened) return;
    Alert.alert('Watch link', 'An official watch link is not available for this episode yet.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Fresh Dub Drops"
        subtitle={fetchedAt ? `${total} official drops · ${timeAgo(fetchedAt)}` : 'Live Hindi, Tamil & Telugu drops'}
        emoji="🎙️"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={tint}
          />
        }
      >
        <FadeInView delay={40}>
          <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.heroGlow, { backgroundColor: `${tint}22` }]} />
            <Text style={styles.heroEmoji}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Indian Anime Drops</Text>
              <Text style={[styles.heroText, { color: colors.textMuted }]}>
                New Hindi, Tamil and Telugu episodes as soon as they are announced.
              </Text>
            </View>
          </View>
        </FadeInView>

        {/* Stats */}
        {sources.length > 0 && (
          <FadeInView delay={70}>
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: tint }]}>{total}</Text>
                <Text style={[styles.statLabel, { color: colors.textDim }]}>Drops</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: tint }]}>{languages.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textDim }]}>Languages</Text>
              </View>
            </View>
          </FadeInView>
        )}


        {/* Language filters */}
        {languages.length > 0 && (
          <FadeInView delay={120}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {['all', ...languages].map((lang) => {
                const active = language === lang;
                const color = LANG_COLOR[lang] || tint;
                return (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    style={[
                      styles.langChip,
                      { borderColor: active ? color : colors.border, backgroundColor: active ? `${color}22` : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? color : colors.textMuted, fontWeight: '700' }]}>
                      {lang === 'all' ? 'All languages' : lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </FadeInView>
        )}

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} colors={colors} />
            ))}
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🎙️</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No dub uploads right now</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              The official channels haven't posted a new episode yet. Check the daily dub schedule for
              what's releasing next.
            </Text>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: tint }]}
              onPress={() => navigation.navigate('DailyDubSchedule')}
            >
              <Text style={styles.ctaText}>Open Daily Dub Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostCta} onPress={() => load()}>
              <Text style={[styles.ghostCtaText, { color: colors.textMuted }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry, i) => {
              const color = LANG_COLOR[entry.language] || tint;
              const ep = episodeNumber(entry.title);
              return (
                <FadeInView key={`${entry.videoId}-${i}`} delay={80 + Math.min(i, 8) * 30} offset={12}>
                  <PressableScale
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => openEntry(entry)}
                  >
                    <Thumb entry={entry} color={color} />
                    <View style={{ flex: 1, paddingVertical: 2 }}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {cleanText(entry.title.replace(/\[[^\]]*\]\s*/g, ''))}
                      </Text>
                      <View style={styles.metaRow}>
                        {ep && (
                          <View style={[styles.epPill, { borderColor: `${color}88`, backgroundColor: `${color}14` }]}>
                            <Text style={[styles.epText, { color }]}>{ep}</Text>
                          </View>
                        )}
                        <Text style={[styles.sourceText, { color: colors.textDim }]} numberOfLines={1}>
                          {entry.language || 'Streaming'}
                        </Text>
                      </View>
                      <View style={styles.bottomRow}>
                        <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo(entry.published)}</Text>
                        <Text style={[styles.watchAction, { color: tint }]}>Watch →</Text>
                      </View>
                    </View>
                  </PressableScale>
                </FadeInView>
              );
            })}
          </View>
        )}
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
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -60, top: -80 },
  heroEmoji: { fontSize: 32 },
  heroTitle: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  heroText: { fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.md, marginTop: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  chipRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },
  countPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  countText: { fontSize: 9, fontWeight: '900' },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1 },
  list: { padding: spacing.md, gap: 12 },
  card: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 10,
    gap: 12,
  },
  thumbWrap: {
    width: 116,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#0a0b12',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 10, marginLeft: 1 },
  langBadge: { position: 'absolute', bottom: 5, right: 5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  langBadgeText: { color: '#0b0b10', fontSize: 9, fontWeight: '900' },
  cardTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  epPill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  epText: { fontSize: 9, fontWeight: '900' },
  sourceText: { fontSize: 11, flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  timeText: { fontSize: 10 },
  watchAction: { fontSize: 11, fontWeight: '800' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  centerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  cta: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: borderRadius.md },
  ctaText: { color: '#0b0b10', fontSize: 12, fontWeight: '900' },
  ghostCta: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 6 },
  ghostCtaText: { fontSize: 12, fontWeight: '700' },
});
