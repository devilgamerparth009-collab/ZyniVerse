import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import SafeImage from '../components/SafeImage';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { directSuggestions } from '../services/anilistDirect';
import { listLocalRecords, putLocalRecord, removeLocalRecord } from '../services/localRepo';

type TrackerStatus = 'Watching' | 'Planned' | 'Completed' | 'Dropped';

interface TrackerEntry {
  animeId: number;
  title: string;
  image?: string;
  status: TrackerStatus;
  progress: number;
  total?: number;
  addedAt: number;
  updatedAt: number;
}

interface Suggestion {
  id: number;
  title?: string;
  titleRomaji?: string;
  poster?: string;
  format?: string;
  year?: number;
  episodes?: number;
}

const STATUSES: TrackerStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];
const FILTERS = ['All', ...STATUSES] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TINT: Record<TrackerStatus, string> = {
  Watching: '#22d3ee',
  Planned: '#f59e0b',
  Completed: '#22c55e',
  Dropped: '#f87171',
};

export default function TrackerScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();

  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const records = await listLocalRecords<TrackerEntry>('tracker:entries');
      if (mounted.current) setEntries(records.map((record) => record.data));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await directSuggestions(needle);
        if (alive && mounted.current) {
          setSuggestions(
            (results || [])
              .filter((item: Suggestion) => Number(item?.id) > 0)
              .slice(0, 8)
              .map((item: Suggestion) => ({
                id: Number(item.id),
                title: item.title || item.titleRomaji || 'Untitled',
                titleRomaji: item.titleRomaji,
                poster: item.poster,
                format: item.format,
                year: item.year,
                episodes: item.episodes,
              }))
          );
        }
      } catch {
        if (alive && mounted.current) setSuggestions([]);
      } finally {
        if (alive && mounted.current) setSearching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const saveEntry = useCallback(async (next: TrackerEntry) => {
    await putLocalRecord('tracker:entries', next, `anime-${next.animeId}`);
    await load();
  }, [load]);

  const addSuggestion = useCallback(
    async (item: Suggestion) => {
      const now = Date.now();
      await saveEntry({
        animeId: item.id,
        title: item.title || 'Untitled',
        image: item.poster,
        status: 'Planned',
        progress: 0,
        total: item.episodes || undefined,
        addedAt: now,
        updatedAt: now,
      });
      setQuery('');
      setSuggestions([]);
    },
    [saveEntry]
  );

  const visible = useMemo(
    () => (filter === 'All' ? entries : entries.filter((entry) => entry.status === filter)),
    [entries, filter]
  );

  const cycleStatus = useCallback(
    (entry: TrackerEntry) => {
      const next = STATUSES[(STATUSES.indexOf(entry.status) + 1) % STATUSES.length];
      void saveEntry({ ...entry, status: next, updatedAt: Date.now() });
    },
    [saveEntry]
  );

  const advance = useCallback(
    (entry: TrackerEntry) => {
      const cap = entry.total && entry.total > 0 ? entry.total : 9999;
      const progress = Math.min(cap, entry.progress + 1);
      const status: TrackerStatus =
        entry.total && progress >= entry.total ? 'Completed' : entry.status === 'Planned' ? 'Watching' : entry.status;
      void saveEntry({ ...entry, progress, status, updatedAt: Date.now() });
    },
    [saveEntry]
  );

  const remove = useCallback(
    (entry: TrackerEntry) => {
      Alert.alert('Remove title?', `Remove ${entry.title} from your tracker?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removeLocalRecord('tracker:entries', `anime-${entry.animeId}`).then(load);
          },
        },
      ]);
    },
    [load]
  );

  const renderEntry = ({ item }: { item: TrackerEntry }) => {
    const tint = STATUS_TINT[item.status];
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SafeImage uri={item.image} style={styles.poster} fallbackLabel={item.title} />
        <View style={styles.cardBody}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.sub, { color: theme.textDim }]}>
            {item.progress}{item.total ? ` / ${item.total}` : ''} episodes · Saved on this device
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => cycleStatus(item)}
              style={[styles.chip, { backgroundColor: `${tint}22`, borderColor: `${tint}66` }]}
            >
              <Text style={[styles.chipText, { color: tint }]}>{item.status}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => advance(item)} style={[styles.chip, { borderColor: theme.border }]}>
              <Text style={[styles.chipText, { color: theme.text }]}>+1 ep</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(item)} accessibilityLabel={`Remove ${item.title}`}>
              <Text style={[styles.delete, { color: theme.textDim }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Anime Tracker"
        emoji="📺"
        subtitle="Never lose track of your watchlist"
      />

      <View style={[styles.searchWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find an anime to track"
          placeholderTextColor={theme.textDim}
          style={[styles.searchInput, { color: theme.text }]}
          autoCorrect={false}
        />
        {searching && <ActivityIndicator color={colors.primary} size="small" />}
      </View>

      {query.trim().length >= 2 ? (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => void addSuggestion(item)}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <SafeImage uri={item.poster} style={styles.poster} fallbackLabel={item.title} />
              <View style={styles.cardBody}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.sub, { color: theme.textDim }]}>
                  {item.year ? `${item.year} · ` : ''}{item.format || 'Anime'} · Tap to add
                </Text>
              </View>
            </PressableScale>
          )}
          ListEmptyComponent={
            !searching ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches yet</Text>
                <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                  Try the English or Japanese title.
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            style={styles.filters}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
            renderItem={({ item }) => {
              const active = filter === item;
              return (
                <TouchableOpacity
                  onPress={() => setFilter(item)}
                  style={[
                    styles.filterChip,
                    { borderColor: theme.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.filterText, { color: active ? '#08090f' : theme.textMuted }]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
          <View style={styles.listArea}>
            <FlatList
              data={visible}
              keyExtractor={(item) => String(item.animeId)}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
              renderItem={renderEntry}
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>📺</Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Your tracker is empty</Text>
                    <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                      Search above to save an anime. Everything stays on this device.
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        </>
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
  listArea: { flex: 1 },
  filters: { marginTop: spacing.sm, maxHeight: 42, flexGrow: 0 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1 },
  filterText: { fontSize: fontSize.xs, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  poster: { width: 58, height: 82, borderRadius: borderRadius.sm },
  cardBody: { flex: 1, justifyContent: 'center' },
  title: { fontSize: fontSize.sm, fontWeight: '800' },
  sub: { fontSize: fontSize.xs, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '800' },
  delete: { fontSize: 14, fontWeight: '800', paddingHorizontal: 4 },
  empty: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 38, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.sm, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 6 },
});
