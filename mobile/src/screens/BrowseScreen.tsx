import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { Anime, MediaPage } from '../types';
import AnimeCard, { GRID_CARD_WIDTH } from '../components/AnimeCard';
import ErrorView from '../components/ErrorView';
import LoadingSpinner from '../components/LoadingSpinner';
import FadeInView from '../components/FadeInView';

type SortKey = 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'POPULARITY_DESC', label: 'Popular' },
  { key: 'SCORE_DESC', label: 'Top Rated' },
  { key: 'START_DATE_DESC', label: 'Newest' },
];

export default function BrowseScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const primaryAccent = isLaunch ? '#22d3ee' : colors.primary;

  const mode: string | undefined = route.params?.mode;
  const genre: string | undefined = route.params?.genre;
  const initialSearch: string | undefined = route.params?.search;
  const heading: string = route.params?.title || genre || initialSearch || 'Browse';

  const isPaged = mode === 'upcoming' || !!genre || !!initialSearch;
  const [sort, setSort] = useState<SortKey>(
    mode === 'top-rated' ? 'SCORE_DESC' : mode === 'upcoming' ? 'START_DATE_DESC' : 'POPULARITY_DESC'
  );

  const [items, setItems] = useState<Anime[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number): Promise<MediaPage> => {
      if (mode === 'upcoming') return api.upcoming.get(targetPage, 30);
      if (mode === 'seasonal') {
        const media = await api.seasonal.get(50);
        return { pageInfo: { hasNextPage: false, total: media.length }, media };
      }
      if (mode === 'trending') {
        const media = await api.trending.get(50);
        return { pageInfo: { hasNextPage: false, total: media.length }, media };
      }
      if (mode === 'popular') {
        const media = await api.popular.get(50);
        return { pageInfo: { hasNextPage: false, total: media.length }, media };
      }
      if (mode === 'top-rated') {
        const media = await api.topRated.get(50);
        return { pageInfo: { hasNextPage: false, total: media.length }, media };
      }
      return api.browse({
        page: targetPage,
        perPage: 30,
        genre,
        search: initialSearch,
        sort,
      });
    },
    [mode, genre, initialSearch, sort]
  );

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      try {
        setError(null);
        const result = await fetchPage(targetPage);
        setItems((prev) => (replace ? result.media : [...prev, ...result.media]));
        setHasNext(!!result.pageInfo?.hasNextPage);
        setPage(targetPage);
      } catch (e: any) {
        setError(e?.message || 'Could not load anime');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    setLoading(true);
    setItems([]);
    load(1, true);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true);
  };

  const onEndReached = () => {
    if (!isPaged || !hasNext || loadingMore || loading) return;
    setLoadingMore(true);
    load(page + 1, false);
  };

  const showSort = isPaged && !mode?.includes('upcoming');

  const header = useMemo(
    () => (
      <View>
        {showSort && (
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                  onPress={() => setSort(opt.key)}
                >
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {mode === 'seasonal' && (
          <Text style={styles.hint}>Most popular anime airing this season</Text>
        )}
        {mode === 'upcoming' && (
          <Text style={styles.hint}>Highly anticipated anime yet to air</Text>
        )}
      </View>
    ),
    [showSort, sort, mode]
  );

  if (loading) return <LoadingSpinner fullScreen />;

  if (error && items.length === 0) {
    return <ErrorView message={error} onRetry={() => load(1, true)} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      columnWrapperStyle={styles.column}
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      ListHeaderComponent={
        <FadeInView>
          <Text style={styles.heading}>{heading}</Text>
          {header}
        </FadeInView>
      }
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min((index % 6) * 45, 270)} offset={18}>
          <AnimeCard anime={item} width={GRID_CARD_WIDTH} />
        </FadeInView>
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>No anime found here yet</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Recommendations')}
          >
            <Text style={styles.emptyButtonText}>Browse Recommendations</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heading: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  hint: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  sortTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  column: {
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
}));
