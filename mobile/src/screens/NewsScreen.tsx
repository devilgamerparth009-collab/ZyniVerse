import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { NewsItem } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';
import { timeAgo, truncate } from '../utils/helpers';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'trending', label: '🔥 Trending' },
  { key: 'airing', label: '📺 Airing' },
  { key: 'community', label: '💬 Community' },
  { key: 'news', label: '📰 News' },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDiwali } = useTheme();
  const tint = isDiwali ? '#f59e0b' : colors.primary;

  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (type = filter) => {
      setError(null);
      try {
        const data = await api.fun.news(type, 'all');
        setItems(data || []);
      } catch {
        setError('Could not load the news feed.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    setLoading(true);
    load(filter);
  }, [filter, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(filter);
  };

  const open = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const hero = items[0];
  const rest = items.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Anime News" emoji="📰" subtitle="Fresh from the ZyniVerse feed" accent={tint} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />}
      >
        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? tint : colors.surface,
                    borderColor: active ? tint : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? '#08090f' : colors.textMuted, fontWeight: active ? '900' : '600' },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tint} size="large" />
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={() => load(filter)} />
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Nothing here yet. Try another filter or pull to refresh.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.md }}>
            {/* Hero story */}
            {hero && (
              <FadeInView delay={20}>
                <PressableScale onPress={() => open(hero.url)}>
                  <View style={[styles.heroCard, { borderColor: colors.border }]}>
                    {hero.image ? (
                      <Image source={{ uri: hero.image }} style={styles.heroImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.heroImage, styles.heroFallback, { backgroundColor: `${tint}22` }]}>
                        <Text style={{ fontSize: 44 }}>📰</Text>
                      </View>
                    )}
                    <View style={styles.heroBody}>
                      <View style={[styles.sourceTag, { backgroundColor: `${tint}1f` }]}>
                        <Text style={[styles.sourceText, { color: tint }]}>
                          {String(hero.source || 'ZyniVerse').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={3}>
                        {hero.title}
                      </Text>
                      <Text style={[styles.heroSummary, { color: colors.textMuted }]} numberOfLines={3}>
                        {truncate(hero.summary || '', 180)}
                      </Text>
                      <Text style={[styles.time, { color: colors.textDim }]}>
                        {timeAgo(hero.publishedAt)} · tap to read
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              </FadeInView>
            )}

            {/* Rest */}
            {rest.map((n, i) => (
              <FadeInView key={n.id || `${i}`} delay={60 + Math.min(i * 40, 400)} offset={10}>
                <PressableScale onPress={() => open(n.url)}>
                  <View style={[styles.row, { borderBottomColor: colors.border }]}>
                    {n.image ? (
                      <Image source={{ uri: n.image }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.heroFallback, { backgroundColor: `${tint}18` }]}>
                        <Text style={{ fontSize: 20 }}>📰</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                        {n.title}
                      </Text>
                      <Text style={[styles.rowSummary, { color: colors.textMuted }]} numberOfLines={2}>
                        {truncate(n.summary || '', 110)}
                      </Text>
                      <Text style={[styles.time, { color: colors.textDim }]}>
                        {n.source} · {timeAgo(n.publishedAt)}
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              </FadeInView>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginRight: spacing.sm,
  },
  filterText: {
    fontSize: 11,
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 46,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroImage: {
    width: '100%',
    height: 190,
  },
  heroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    padding: spacing.md,
  },
  sourceTag: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: fontSize.lg,
    fontWeight: '900',
    lineHeight: 24,
  },
  heroSummary: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: 6,
  },
  time: {
    fontSize: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 78,
    height: 78,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 19,
  },
  rowSummary: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});
