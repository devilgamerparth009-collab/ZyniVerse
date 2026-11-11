import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import AnimeCard, { GRID_CARD_WIDTH } from '../components/AnimeCard';
import { Anime } from '../types';
import { api, getCurrentUser } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors: themeColors } = useTheme();

  const [genres, setGenres] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [personalGenres, setPersonalGenres] = useState<string[]>([]);
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGenres = useCallback(async () => {
    try {
      const list = await api.genres();
      setGenres(list);
      return list;
    } catch {
      return [] as string[];
    }
  }, []);

  // Build a real taste profile from the user's own list instead of guessing.
  const loadPersonalGenres = useCallback(async () => {
    const user = await getCurrentUser().catch(() => null);
    if (!user) return [] as string[];
    try {
      const watchlist = await api.watchlist.get();
      const ids = watchlist.map((w) => w.mediaId).slice(0, 50);
      if (ids.length === 0) return [] as string[];
      const media = await api.batch(ids);
      const counts = new Map<string, number>();
      for (const m of media) {
        for (const g of m.genres || []) {
          counts.set(g, (counts.get(g) || 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
    } catch {
      return [] as string[];
    }
  }, []);

  const loadRecommendations = useCallback(async (genreList: string[]) => {
    if (genreList.length === 0) {
      setItems([]);
      return;
    }
    try {
      setError(null);
      const results = await Promise.all(
        genreList.map((g) => api.recommendations(g, 18).catch(() => [] as Anime[]))
      );
      const merged: Anime[] = [];
      const seen = new Set<number>();
      // Interleave genres so the grid mixes picks instead of grouping by genre.
      const maxLen = Math.max(0, ...results.map((r) => r.length));
      for (let i = 0; i < maxLen; i++) {
        for (const list of results) {
          const anime = list[i];
          if (anime && !seen.has(anime.id)) {
            seen.add(anime.id);
            merged.push(anime);
          }
        }
      }
      setItems(merged);
    } catch (e: any) {
      setError(e?.message || 'Could not load recommendations');
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      setError(null);
      const [genreList, personal] = await Promise.all([loadGenres(), loadPersonalGenres()]);
      setPersonalGenres(personal);
      const initial = personal.length > 0 ? personal : genreList.slice(0, 2);
      setSelected(initial);
      await loadRecommendations(initial);
    } catch (e: any) {
      setError(e?.message || 'Could not load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadGenres, loadPersonalGenres, loadRecommendations]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const onRefresh = () => {
    setRefreshing(true);
    bootstrap();
  };

  const toggleGenre = (genre: string) => {
    setSelected((prev) => {
      const next = prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre];
      loadRecommendations(next);
      return next;
    });
  };

  const surpriseMe = () => {
    if (genres.length === 0) return;
    const pick = genres[Math.floor(Math.random() * genres.length)];
    setSelected([pick]);
    loadRecommendations([pick]);
  };

  const usingPersonal = personalGenres.length > 0 && selected.join('|') === personalGenres.join('|');

  const header = useMemo(
    () => (
      <View>
        <FadeInView delay={0}>
          <View style={styles.intro}>
            <Text style={styles.heading}>For You</Text>
            <Text style={styles.subheading}>
              {usingPersonal
                ? 'Based on genres you already watch'
                : selected.length > 0
                  ? 'Picked from your selected genres'
                  : 'Choose a genre to get started'}
            </Text>
          </View>
        </FadeInView>

        <FadeInView delay={60} style={styles.actionsRow}>
          <TouchableOpacity style={styles.surpriseButton} onPress={surpriseMe}>
            <Text style={styles.surpriseText}>🎲 Surprise Me</Text>
          </TouchableOpacity>
          {personalGenres.length > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSelected(personalGenres);
                loadRecommendations(personalGenres);
              }}
            >
              <Text style={styles.resetText}>↺ Use My Taste</Text>
            </TouchableOpacity>
          )}
        </FadeInView>

        <FadeInView delay={110}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreScroll}
          >
            {genres.map((genre) => {
              const active = selected.includes(genre);
              return (
                <TouchableOpacity
                  key={genre}
                  style={[styles.genreChip, active && styles.genreChipActive]}
                  onPress={() => toggleGenre(genre)}
                >
                  <Text style={[styles.genreText, active && styles.genreTextActive]}>{genre}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </FadeInView>
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [genres, selected, personalGenres, usingPersonal]
  );

  if (loading) return <LoadingSpinner fullScreen />;
  if (error && items.length === 0) {
    return <ErrorView message={error} onRetry={bootstrap} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      columnWrapperStyle={styles.column}
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index * 40, 320)} offset={12} duration={340}>
          <AnimeCard anime={item} width={GRID_CARD_WIDTH} />
        </FadeInView>
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyText}>Pick a genre above</Text>
          <Text style={styles.emptyHint}>
            Recommendations update instantly as you select genres.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.emptyButtonText}>Browse All Anime</Text>
          </TouchableOpacity>
        </View>
      }
      ListFooterComponent={
        items.length > 0 ? (
          <ActivityIndicator style={{ opacity: 0 }} color={colors.primary} />
        ) : null
      }
    />
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  intro: {
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  subheading: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  surpriseButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(192,132,252,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.4)',
  },
  surpriseText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  resetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  resetText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  genreScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  genreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  genreChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  genreText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  genreTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  column: {
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 44,
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
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
}));
