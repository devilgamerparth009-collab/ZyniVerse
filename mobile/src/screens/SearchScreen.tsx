import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { api } from '../services/api';
import { Anime, SearchSuggestion } from '../types';
import AnimeCard, { GRID_CARD_WIDTH } from '../components/AnimeCard';
import ErrorView from '../components/ErrorView';
import AdBanner from '../components/AdBanner';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../hooks/useTheme';

const HISTORY_KEY = 'zt_search_history_v1';
const MAX_HISTORY = 8;

const CATEGORIES: { key: string; label: string; mode: string }[] = [
  { key: 'trending', label: '🔥 Trending', mode: 'trending' },
  { key: 'popular', label: '⭐ Popular', mode: 'popular' },
  { key: 'top-rated', label: '🏆 Top Rated', mode: 'top-rated' },
  { key: 'seasonal', label: '🌸 This Season', mode: 'seasonal' },
  { key: 'upcoming', label: '⏳ Upcoming', mode: 'upcoming' },
];

/** Related discovery features that deserve a visible shortcut. */
const EXPLORE_ITEMS: {
  key: string;
  icon: string;
  label: string;
  sub: string;
  tint: string;
  route: string;
  params?: Record<string, any>;
}[] = [
  { key: 'dubhub', icon: '🎬', label: 'Dub Hub', sub: 'Dubbed series, movies and schedule', tint: '#ff9933', route: 'HindiDub', params: { tab: 'all' } },
  { key: 'taste', icon: '🧬', label: 'Taste Profile', sub: 'Find anime matched to you', tint: '#a78bfa', route: 'TasteProfile' },
  { key: 'manga', icon: '📚', label: 'Manga', sub: 'Explore manga and light novels', tint: '#f87171', route: 'Manga' },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const primaryColor = isDiwali ? '#FF8C00' : colors.primary;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [results, setResults] = useState<Anime[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      setHistory(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    api.genres().then(setGenres).catch(() => setGenres([]));
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const saveHistory = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(
        0,
        MAX_HISTORY
      );
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Typeahead: debounce 280ms and ignore stale responses.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2 || searched) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }
    setSuggesting(true);
    debounceRef.current = setTimeout(async () => {
      const id = ++requestId.current;
      try {
        const list = await api.suggestions(trimmed);
        if (id === requestId.current) setSuggestions(list.slice(0, 10));
      } catch {
        if (id === requestId.current) setSuggestions([]);
      } finally {
        if (id === requestId.current) setSuggesting(false);
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searched]);

  const runSearch = useCallback(
    async (term: string, targetPage = 1) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      setSearched(true);
      setSuggestions([]);
      if (targetPage === 1) {
        setLoading(true);
        setError(null);
        setResults([]);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await api.browse({ search: trimmed, page: targetPage, perPage: 30 });
        setResults((prev) => (targetPage === 1 ? result.media : [...prev, ...result.media]));
        setHasNext(!!result.pageInfo?.hasNextPage);
        setPage(targetPage);
        if (targetPage === 1) saveHistory(trimmed);
      } catch (e: any) {
        if (targetPage === 1) setError(e?.message || 'Search failed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [saveHistory]
  );

  const clearSearch = () => {
    setQuery('');
    setSearched(false);
    setResults([]);
    setSuggestions([]);
    setError(null);
  };

  const removeHistory = async (term: string) => {
    const next = history.filter((h) => h !== term);
    setHistory(next);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
  };

  const openGenre = (genre: string) =>
    navigation.navigate('Browse', { genre, title: genre });

  const openCategory = (cat: (typeof CATEGORIES)[number]) =>
    navigation.navigate('Browse', { mode: cat.mode, title: cat.label.replace(/^[^\w]+\s*/, '') });

  const showingSuggestions = !searched && query.trim().length >= 2 && suggestions.length > 0;

  const renderResults = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      );
    }
    if (error) {
      return <ErrorView message={error} onRetry={() => runSearch(query)} />;
    }
    if (searched && results.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>No results for "{query.trim()}"</Text>
          <Text style={styles.emptyHint}>Try a different spelling or a shorter title.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingBottom: spacing.xxl, paddingHorizontal: spacing.md }}
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index * 40, 320)} offset={12} duration={340}>
            <AnimeCard anime={item} width={GRID_CARD_WIDTH} />
          </FadeInView>
        )}
        onEndReached={() => {
          if (hasNext && !loadingMore) runSearch(query, page + 1);
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />
          ) : null
        }
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.background }]}>
      <FadeInView delay={0} style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Discover</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Recommendations')}>
          <Text style={styles.forYou}>✨ For You</Text>
        </TouchableOpacity>
      </FadeInView>

      <FadeInView delay={60} style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search anime, movies, OVAs…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (searched) {
              setSearched(false);
              setResults([]);
            }
          }}
          onSubmitEditing={() => runSearch(query)}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </FadeInView>

      {showingSuggestions && (
        <FadeInView delay={0} style={styles.suggestionsBox}>
          {suggesting && (
            <ActivityIndicator style={{ padding: spacing.sm }} color={colors.primary} size="small" />
          )}
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestionRow}
              onPress={() => {
                saveHistory(s.title);
                navigation.navigate('AnimeDetail', { id: s.id, title: s.title });
              }}
            >
              {s.poster ? (
                <Image source={{ uri: s.poster }} style={styles.suggestionImage} />
              ) : (
                <View style={[styles.suggestionImage, styles.suggestionPlaceholder]}>
                  <Text style={styles.suggestionPlaceholderText}>?</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={styles.suggestionMeta} numberOfLines={1}>
                  {[s.format, s.year, s.episodes ? `${s.episodes} eps` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.suggestionArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </FadeInView>
      )}

      {!showingSuggestions && !searched && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView delay={0}>
            <AdBanner placement="search-card" />
          </FadeInView>
          {history.length > 0 && (
            <FadeInView delay={60} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent</Text>
              </View>
              <View style={styles.chipWrap}>
                {history.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={styles.historyChip}
                    onPress={() => runSearch(term)}
                    onLongPress={() => removeHistory(term)}
                  >
                    <Text style={styles.historyText}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.hintText}>Long-press a chip to remove it.</Text>
            </FadeInView>
          )}

          <FadeInView delay={110} style={styles.section}>
            <Text style={styles.sectionTitle}>Browse</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={styles.categoryCard}
                  activeOpacity={0.8}
                  onPress={() => openCategory(cat)}
                >
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.categoryCard, styles.categoryRecommend]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Recommendations')}
              >
                <Text style={styles.categoryLabel}>✨ Recommendations</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryCard, styles.categoryDub]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Dubbed')}
              >
                <Text style={styles.categoryLabel}> Anime Dubs</Text>
              </TouchableOpacity>
            </View>
          </FadeInView>

          <FadeInView delay={140} style={styles.exploreSection}>
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
                  <Text style={[styles.exploreArrow, { color: colors.primary }]}>›</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </FadeInView>

          {genres.length > 0 && (
            <FadeInView delay={160} style={styles.section}>
              <Text style={styles.sectionTitle}>Genres</Text>
              <View style={styles.chipWrap}>
                {genres.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={styles.genreChip}
                    onPress={() => openGenre(genre)}
                  >
                    <Text style={styles.genreText}>{genre}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FadeInView>
          )}
        </ScrollView>
      )}

      {searched && <View style={{ flex: 1 }}>{renderResults()}</View>}
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  forYou: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 46,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  searchIcon: {
    color: colors.textDim,
    fontSize: 18,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearText: {
    color: colors.textDim,
    fontSize: 14,
  },
  suggestionsBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  suggestionImage: {
    width: 34,
    height: 46,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
  },
  suggestionPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionPlaceholderText: {
    color: colors.textDim,
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  suggestionMeta: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  suggestionArrow: {
    color: colors.primary,
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  historyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  historyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  hintText: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  categoryRecommend: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderColor: 'rgba(192,132,252,0.35)',
  },
  categoryDub: {
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderColor: 'rgba(34,211,238,0.35)',
  },
  categoryLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  exploreSection: {
    marginTop: spacing.lg,
  },
  exploreTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  exploreRow: {
    gap: spacing.sm,
  },
  exploreCard: {
    width: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
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
  genreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  genreText: {
    color: colors.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textDim,
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  column: {
    gap: spacing.md,
  },
}));
