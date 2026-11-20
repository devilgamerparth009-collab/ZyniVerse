import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { HotEpisodeRow, HotEpisodesResponse } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import SafeImage from '../components/SafeImage';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';
import { timeAgo } from '../utils/helpers';

/**
 * Anonymous aggregate reactions to exact episodes. No user posts, no video
 * links and no third-party destinations — only ZyniVerse metadata and AniList
 * artwork, with a native route back into the title's detail screen.
 */
export default function EpisodePulseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<HotEpisodeRow[]>([]);
  const [titles, setTitles] = useState<HotEpisodesResponse['titles']>({});
  const [since, setSince] = useState<string>('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.fun.hotEpisodes(7, 12);
      setRows(Array.isArray(data?.hot) ? data.hot : []);
      setTitles(data?.titles || {});
      setSince(data?.since || '');
    } catch (e: any) {
      setError(e?.message || 'Could not load episode reactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;

  const openTitle = (row: HotEpisodeRow) => {
    const meta = titles[String(row.mediaId)];
    navigation.navigate('AnimeDetail', {
      id: row.mediaId,
      title: meta?.title,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Episode Pulse"
        subtitle="Which episodes fans are reacting to"
        emoji="🔥"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
      >
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No reactions yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Episode reactions appear here once the community starts reacting.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.caption, { color: colors.textMuted }]}>
              {since ? `Counting reactions since ${timeAgo(since)}` : 'Last 7 days'}
            </Text>
            {rows.map((row, index) => {
              const meta = titles[String(row.mediaId)];
              const title = meta?.title || `Anime #${row.mediaId}`;
              return (
                <FadeInView key={`${row.mediaId}-${row.episode}`} delay={Math.min(index * 35, 350)} offset={8}>
                  <PressableScale
                    scaleTo={0.985}
                    onPress={() => openTitle(row)}
                    style={[
                      styles.card,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.rank, { color: colors.primary }]}>
                      #{index + 1}
                    </Text>
                    <SafeImage
                      uri={meta?.coverImage}
                      fallbackLabel={title}
                      style={styles.poster}
                    />
                    <View style={styles.cardBody}>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text style={[styles.episode, { color: colors.primary }]}>
                        Episode {row.episode}
                      </Text>
                      <Text style={[styles.reactions, { color: colors.textMuted }]}>
                        🔥 {row.reactionCount} community reactions
                      </Text>
                    </View>
                  </PressableScale>
                </FadeInView>
              );
            })}
            <Text style={[styles.footer, { color: colors.textDim }]}>
              Community reactions only. Open a title for details and its official trailer.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md },
  caption: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rank: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    width: 32,
    textAlign: 'center',
  },
  poster: {
    width: 54,
    height: 78,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  episode: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 4,
  },
  reactions: {
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl || 64,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  emptyBody: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  footer: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
