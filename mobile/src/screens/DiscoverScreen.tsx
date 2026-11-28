import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import SafeImage from '../components/SafeImage';
import FadeInView from '../components/FadeInView';
import ErrorView from '../components/ErrorView';
import LoadingSpinner from '../components/LoadingSpinner';
import PressableScale from '../components/PressableScale';
import AdBanner from '../components/AdBanner';
import { useTheme } from '../hooks/useTheme';
import { colors, borderRadius, fontSize, spacing, themed } from '../theme';
import {
  loadDiscover,
  localCollectionForMode,
  modeHasAdd,
  modeMeta,
  type DiscoverItem,
  type DiscoverResult,
} from '../services/discoverData';
import { putLocalRecord, removeLocalRecord } from '../services/localRepo';
import { clearScreenCache, getScreenCache, setScreenCache } from '../utils/screenCache';
import type { DiscoverMode } from '../types';

const CHIP_MODES = new Set<DiscoverMode>(['genres', 'tags', 'a-z']);

function placeholderFor(mode: DiscoverMode): string {
  if (mode === 'watch-order') return 'Search an anime to build its watch order';
  if (mode === 'compare') return 'Title A | Title B';
  if (mode === 'semantic') return 'Describe the kind of anime you want';
  if (mode === 'characters' || mode === 'staff' || mode === 'studios') return 'Search anime, characters, or staff';
  return 'Search this screen';
}

export default function DiscoverScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const initialMode: DiscoverMode = route.params?.mode || 'genres';
  const [mode, setMode] = useState<DiscoverMode>(initialMode);
  const [input, setInput] = useState(String(route.params?.query || ''));
  const [query, setQuery] = useState(String(route.params?.query || ''));
  const [letter, setLetter] = useState<string | undefined>(route.params?.letter);
  const [tag, setTag] = useState<string | undefined>(route.params?.tag);
  const [mediaId, setMediaId] = useState<number | undefined>(route.params?.id);
  const [data, setData] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const nextMode: DiscoverMode = route.params?.mode || 'genres';
    const nextQuery = String(route.params?.query || '');
    setMode(nextMode);
    setInput(nextQuery);
    setQuery(nextQuery);
    setLetter(route.params?.letter);
    setTag(route.params?.tag);
    setMediaId(route.params?.id);
    setData(null);
  }, [route.params]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  const cacheKey = useMemo(
    () => `discover:${mode}:${query}:${letter || ''}:${tag || ''}:${mediaId || ''}`,
    [mode, query, letter, tag, mediaId]
  );

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const cached = getScreenCache<DiscoverResult>(cacheKey, 60_000);
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
      }
      try {
        setError(null);
        const result = await loadDiscover(mode, { query, letter, tag, id: mediaId });
        setData(result);
        setScreenCache(cacheKey, result);
      } catch (e: any) {
        setError(e?.message || 'Could not load this screen');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey, mode, query, letter, tag, mediaId]
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const meta = useMemo(() => modeMeta(mode), [mode]);
  const isChips = CHIP_MODES.has(mode) && !letter;
  const canAdd = modeHasAdd(mode);
  const collection = localCollectionForMode(mode);

  const openItem = useCallback(
    async (item: DiscoverItem) => {
      const targetMode = item.meta?.targetMode as DiscoverMode | undefined;
      if (targetMode) {
        setMode(targetMode);
        setInput('');
        setQuery('');
        setLetter(undefined);
        setTag(undefined);
        setMediaId(undefined);
        return;
      }
      if (item.meta?.genre) {
        navigation.navigate('Browse', { genre: item.meta.genre, title: item.title });
        return;
      }
      if (item.meta?.tag) {
        setTag(String(item.meta.tag));
        setMode('tag-media');
        setInput('');
        setQuery('');
        return;
      }
      if (item.meta?.letter) {
        setLetter(String(item.meta.letter));
        setQuery('');
        setInput('');
        return;
      }
      if (item.meta?.animeId) {
        navigation.navigate('AnimeDetail', { id: Number(item.meta.animeId), title: item.title });
        return;
      }
      if (item.kind === 'anime' && item.meta?.id) {
        navigation.navigate('AnimeDetail', { id: Number(item.meta.id), title: item.title });
        return;
      }
      if (item.kind === 'manga') {
        navigation.navigate('Manga');
        return;
      }
      if (item.kind === 'local') {
        Alert.alert(item.title, item.subtitle || 'Saved on this device', [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const recordId = item.meta?.recordId;
              const recordCollection = item.meta?.collection;
              if (!recordId || !recordCollection) return;
              await removeLocalRecord(recordCollection, recordId);
              clearScreenCache('local-data');
              load(true);
            },
          },
        ]);
        return;
      }
      Alert.alert(item.title, item.subtitle || meta.subtitle);
    },
    [load, meta.subtitle, navigation]
  );

  const saveDraft = useCallback(async () => {
    const title = draft.trim();
    if (!title || !collection) return;
    setDraft('');
    await putLocalRecord(collection, { title, body: '', mode });
    clearScreenCache('local-data');
    await load(true);
  }, [collection, draft, load, mode]);

  const renderCard = (item: DiscoverItem, index: number) => {
    const showImage = !isChips && !!item.image && item.kind !== 'info';
    return (
      <FadeInView delay={Math.min((index % 8) * 28, 220)} offset={12}>
        <PressableScale
          accessibilityLabel={item.title}
          onPress={() => void openItem(item)}
          style={[
            styles.card,
            isChips && styles.chipCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {showImage ? (
            <SafeImage
              uri={item.image}
              fallbackLabel={item.title}
              style={[styles.image, { backgroundColor: colors.background }]}
            />
          ) : null}
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={isChips ? 1 : 2}>
              {item.title}
            </Text>
            {!!item.subtitle && !isChips ? (
              <Text style={[styles.cardSubtitle, { color: colors.textDim }]} numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
            <View style={styles.badgeRow}>
              {!!item.badge ? (
                <Text style={[styles.badge, { color: colors.primary }]}>{item.badge}</Text>
              ) : null}
              {!!item.score ? (
                <Text style={[styles.score, { color: colors.success }]}>★ {item.score.toFixed(1)}</Text>
              ) : null}
            </View>
          </View>
        </PressableScale>
      </FadeInView>
    );
  };

  const header = (
    <FadeInView>
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{data?.title || meta.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {data?.subtitle || meta.subtitle}
        </Text>
        {!!data?.note ? (
          <Text style={[styles.note, { color: colors.textDim }]}>{data.note}</Text>
        ) : null}
      </View>

      <View
        style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder={placeholderFor(mode)}
          placeholderTextColor={colors.textDim}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {!!input ? (
          <TouchableOpacity onPress={() => { setInput(''); setQuery(''); }} accessibilityLabel="Clear search">
            <Text style={[styles.clear, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!!letter ? (
        <TouchableOpacity
          style={[styles.backChip, { borderColor: colors.border }]}
          onPress={() => { setLetter(undefined); setQuery(''); setInput(''); }}
        >
          <Text style={[styles.backChipText, { color: colors.primary }]}>← All letters</Text>
        </TouchableOpacity>
      ) : null}
      {mode === 'tag-media' && !!tag ? (
        <TouchableOpacity
          style={[styles.backChip, { borderColor: colors.border }]}
          onPress={() => { setMode('tags'); setTag(undefined); setQuery(''); setInput(''); }}
        >
          <Text style={[styles.backChipText, { color: colors.primary }]}>← All tags</Text>
        </TouchableOpacity>
      ) : null}

      {canAdd && collection ? (
        <View style={[styles.addBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.addTitle, { color: colors.text }]}>Add a saved entry</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, { color: colors.text, borderColor: colors.border }]}
              value={draft}
              onChangeText={setDraft}
              placeholder="Title or short note"
              placeholderTextColor={colors.textDim}
              onSubmitEditing={() => void saveDraft()}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => void saveDraft()}
              accessibilityLabel="Save entry"
            >
              <Text style={styles.addButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.addHint, { color: colors.textDim }]}>
            Saved on your device.
          </Text>
        </View>
      ) : null}
    </FadeInView>
  );

  if (loading && !data) return <LoadingSpinner fullScreen />;
  if (error && !data) return <ErrorView message={error} onRetry={() => load(true)} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={data?.title || meta.title}
        subtitle={meta.subtitle}
        emoji="🧭"
      />

      <FlatList<DiscoverItem>
        data={data?.items || []}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={isChips ? 3 : 2}
        columnWrapperStyle={isChips ? styles.chipRow : styles.cardRow}
        style={styles.list}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
        ListHeaderComponent={header}
        ListFooterComponent={
          <View style={styles.adFooter}>
            <AdBanner placement="discover-bottom" size="medium" />
          </View>
        }
        renderItem={({ item, index }) => renderCard(item, index)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              {query ? 'Try a different search.' : 'This native screen has no items right now.'}
            </Text>
          </View>
        }
        initialNumToRender={12}
        windowSize={7}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  adFooter: {
    paddingBottom: spacing.sm,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  note: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    paddingVertical: 0,
  },
  clear: {
    fontSize: 14,
    fontWeight: '800',
  },
  backChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  backChipText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  addBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  addButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  addHint: {
    fontSize: 10,
    marginTop: spacing.xs,
  },
  cardRow: {
    gap: spacing.md,
  },
  chipRow: {
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  chipCard: {
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  image: {
    width: '100%',
    height: 150,
  },
  cardBody: {
    padding: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 10,
    marginTop: spacing.xs,
    lineHeight: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  badge: {
    fontSize: 9,
    fontWeight: '900',
  },
  score: {
    fontSize: 9,
    fontWeight: '900',
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
}));
