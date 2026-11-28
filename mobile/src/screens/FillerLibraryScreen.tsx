import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { listDirectFillerGuides, type FillerGuideSummary } from '../services/fillerDirect';

/** Native mirror of the website's complete AniFiller list. */
export default function FillerLibraryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<FillerGuideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        if (alive) setLoading(true);
        const guides = await listDirectFillerGuides(query);
        if (alive && mounted.current) {
          setItems(guides);
          setError(null);
        }
      } catch (e: any) {
        if (alive && mounted.current) {
          setError(e?.message || 'Could not load filler guides');
          setItems([]);
        }
      } finally {
        if (alive && mounted.current) setLoading(false);
      }
    }, query ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const openGuide = useCallback(
    (guide: FillerGuideSummary) => {
      navigation.navigate('FillerGuide', {
        id: guide.anilistId || 0,
        title: guide.title,
        malId: guide.malId,
      });
    },
    [navigation]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Filler Guides" emoji="⏭️" subtitle="Skip the filler, enjoy the story" />

      <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search every filler guide"
          placeholderTextColor={theme.textDim}
          style={[styles.searchInput, { color: theme.text }]}
          autoCorrect={false}
        />
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: insets.bottom + spacing.xxl,
          }}
          renderItem={({ item }) => (
            <PressableScale
              key={item.slug}
              onPress={() => openGuide(item)}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.chevron, { color: theme.primary }]}>›</Text>
              </View>
              <Text style={[styles.meta, { color: theme.textDim }]}>
                {item.fillerCount} filler · {item.episodeCount} episodes
              </Text>
            </PressableScale>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⏭️</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {error ? 'Could not load guides' : 'No guides match that search'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                {error || 'Try another title. The full guide list loads directly from AniFiller.'}
              </Text>
              {!!error && (
                <TouchableOpacity
                  onPress={() => setQuery((value) => `${value} `)}
                  style={[styles.retry, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: fontSize.sm },
  loading: { marginTop: spacing.xl },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: fontSize.sm, fontWeight: '800' },
  chevron: { fontSize: 22, fontWeight: '800' },
  meta: { fontSize: fontSize.xs, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 38, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.sm, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 6 },
  retry: { marginTop: spacing.md, paddingHorizontal: 18, paddingVertical: 9, borderRadius: borderRadius.full },
  retryText: { color: '#08090f', fontSize: fontSize.xs, fontWeight: '900' },
});
