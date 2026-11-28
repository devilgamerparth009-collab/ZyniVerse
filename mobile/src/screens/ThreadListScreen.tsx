import React, { useState, useEffect, useCallback } from 'react';
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
import { ForumThread } from '../types';
import { formatCount, stripMarkdown, timeAgo } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';
import { SocialAvatar, UserName } from '../components/social/SocialBits';

type SortKey = 'recent' | 'popular' | 'top';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'popular', label: 'Popular' },
  { key: 'top', label: 'Top' },
];

export default function ThreadListScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const category: string | undefined = route.params?.category;
  const animeId: number | undefined = route.params?.animeId;
  const animeTitle: string | undefined = route.params?.animeTitle;

  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      try {
        setError(null);
        const result = await api.forum.threads({
          category,
          animeId,
          sort,
          page: targetPage,
          limit: 20,
        });
        setThreads((prev) => (replace ? result.threads : [...prev, ...result.threads]));
        setTotal(result.total);
        setPage(targetPage);
      } catch (e: any) {
        setError(e?.message || 'Could not load threads');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [category, animeId, sort]
  );

  useEffect(() => {
    setLoading(true);
    setThreads([]);
    fetchPage(1, true);
  }, [fetchPage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage(1, true);
  };

  const onEndReached = () => {
    if (loadingMore || loading) return;
    if (threads.length >= total) return;
    setLoadingMore(true);
    fetchPage(page + 1, false);
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error && threads.length === 0) {
    return <ErrorView message={error} onRetry={() => fetchPage(1, true)} />;
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(item) => item.id}
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View>
          {animeTitle ? (
            <FadeInView delay={0}>
              <TouchableOpacity
                style={styles.animeBanner}
                onPress={() => navigation.navigate('AnimeDetail', { id: animeId, title: animeTitle })}
              >
                <Text style={styles.animeBannerText} numberOfLines={1}>
                  Discussions about {animeTitle}
                </Text>
                <Text style={styles.animeBannerArrow}>→</Text>
              </TouchableOpacity>
            </FadeInView>
          ) : null}
          <FadeInView delay={60} style={styles.headerRow}>
            <Text style={styles.count}>{total} thread{total === 1 ? '' : 's'}</Text>
            <View style={styles.sortRow}>
              {SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.sortChip, active && styles.sortChipActive]}
                    onPress={() => setSort(s.key)}
                  >
                    <Text style={[styles.sortText, active && styles.sortTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FadeInView>
        </View>
      }
      renderItem={({ item, index }) => {
        const postCount = item.postCount ?? item._count?.posts ?? 0;
        return (
          <FadeInView delay={Math.min(index * 40, 320)} offset={12} duration={340}>
            <TouchableOpacity
              style={styles.threadCard}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('ThreadDetail', { id: item.id, title: item.title })
              }
            >
              <View style={styles.threadTop}>
                <Text style={styles.threadCategory}>
                  {item.category?.name || 'General'}
                </Text>
                {item.isPinned ? <Text style={styles.pinned}>📌</Text> : null}
                {item.isLocked ? <Text style={styles.locked}>🔒</Text> : null}
              </View>
              <Text style={styles.threadTitle} numberOfLines={2}>
                {stripMarkdown(item.title)}
              </Text>
              <View style={styles.threadMeta}>
                <View style={styles.threadAuthorRow}>
                  <SocialAvatar uri={item.user?.avatar} name={item.user?.username || 'unknown'} size={20} />
                  <UserName
                    name={item.user?.username || 'unknown'}
                    prefix="@"
                    style={styles.threadAuthor}
                    numberOfLines={1}
                  />
                  <Text style={styles.threadAuthor}> · {timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.threadCount}>
                  💬 {postCount} · 👁 {formatCount(item.viewCount)}
                </Text>
              </View>
            </TouchableOpacity>
          </FadeInView>
        );
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No threads here yet</Text>
          <Text style={styles.emptyHint}>Head to the Forum tab to start one.</Text>
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
  animeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.3)',
    marginBottom: spacing.md,
  },
  animeBannerText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  animeBannerArrow: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  count: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
  },
  sortText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  sortTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  threadCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  threadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  threadCategory: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pinned: {
    fontSize: 10,
  },
  locked: {
    fontSize: 10,
  },
  threadTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 21,
  },
  threadMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  threadAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  threadAuthor: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    flexShrink: 1,
  },
  threadCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginLeft: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  emptyHint: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
}));
