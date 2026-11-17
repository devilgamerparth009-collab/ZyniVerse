import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  SectionList,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import {
  DubAiring,
  DubCatalogTitle,
  DubLanguageStat,
} from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';

const LANG_TINT: Record<string, string> = {
  Hindi: '#ff9933',
  Tamil: '#e84a5f',
  Telugu: '#6c63ff',
  Bengali: '#22c55e',
  Malayalam: '#22d3ee',
  Kannada: '#f59e0b',
  English: '#3b82f6',
  Japanese: '#f472b6',
};

const SORTS: { key: 'recent' | 'title' | 'rating' | 'year'; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'title', label: 'A–Z' },
  { key: 'rating', label: 'Rating' },
  { key: 'year', label: 'Year' },
];

type TabKey = 'series' | 'movies' | 'schedule' | 'languages';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'series', label: 'Series' },
  { key: 'movies', label: 'Movies' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'languages', label: 'Languages' },
];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Adds the IST offset and reads UTC fields, so it works without Intl time zones. */
function istLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const hours = ist.getUTCHours() % 12 || 12;
  const suffix = ist.getUTCHours() < 12 ? 'AM' : 'PM';
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} · ${hours}:${pad(ist.getUTCMinutes())} ${suffix}`;
}

function languageTint(language: string): string {
  return LANG_TINT[language] ?? '#8b5cf6';
}

/* ------------------------------------------------------------------ */
/* Catalogue tab (series / movies)                                     */
/* ------------------------------------------------------------------ */

function CatalogCard({
  item,
  width,
  onPress,
}: {
  item: DubCatalogTitle;
  width: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.card, { width }]} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.posterWrap}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Text style={styles.posterPlaceholderText} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        )}
        <View style={styles.kindBadge}>
          <Text style={styles.kindBadgeText}>{item.kind === 'movie' ? 'MOVIE' : 'SERIES'}</Text>
        </View>
        {item.rating != null ? (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {item.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.langRow}>
        {item.languages.slice(0, 2).map((language) => (
          <View
            key={language}
            style={[styles.langBadge, { borderColor: `${languageTint(language)}88` }]}
          >
            <Text style={[styles.langBadgeText, { color: languageTint(language) }]}>
              {language}
            </Text>
          </View>
        ))}
        {item.languages.length > 2 ? (
          <Text style={styles.moreLangs}>+{item.languages.length - 2}</Text>
        ) : null}
      </View>

      {item.season || item.episodeInfo ? (
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[item.season, item.episodeInfo].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function CatalogTab({
  kind,
  languages,
  initialLanguage,
  onClearInitialLanguage,
}: {
  kind: 'series' | 'movie';
  languages: DubLanguageStat[];
  initialLanguage?: string;
  onClearInitialLanguage: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - spacing.md * 2 - spacing.sm * 2) / 3);
  const [items, setItems] = useState<DubCatalogTitle[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | undefined>(initialLanguage);
  const [sort, setSort] = useState<'recent' | 'title' | 'rating' | 'year'>('recent');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (initialLanguage) {
      setLanguage(initialLanguage);
      onClearInitialLanguage();
    }
    // Only react to an explicit browse request from the Languages tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLanguage]);

  const load = useCallback(
    async (nextPage: number, mode: 'replace' | 'append' = 'replace') => {
      const id = requestId.current + 1;
      requestId.current = id;
      if (mode === 'append') setLoadingMore(true);
      else if (!refreshing) setLoading(true);
      setError(null);

      try {
        const data = await api.dub.catalog({
          kind,
          language,
          q: appliedSearch || undefined,
          sort,
          page: nextPage,
          limit: 27,
        });
        if (requestId.current !== id) return;
        setItems((prev) => (mode === 'append' ? [...prev, ...data.items] : data.items));
        setPage(data.page);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (e: any) {
        if (requestId.current !== id) return;
        setError(e?.message || 'Could not load the dub catalogue');
      } finally {
        if (requestId.current === id) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [kind, language, appliedSearch, sort, refreshing]
  );

  useEffect(() => {
    load(1, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, language, appliedSearch, sort]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, 'replace');
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    load(page + 1, 'append');
  }, [loading, loadingMore, page, totalPages, load]);

  const header = (
    <View style={styles.tabHeader}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${kind === 'movie' ? 'movies' : 'series'}…`}
          placeholderTextColor={colors.textDim}
          returnKeyType="search"
          onSubmitEditing={() => setAppliedSearch(search.trim())}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setAppliedSearch(search.trim())}
          activeOpacity={0.85}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {appliedSearch ? (
        <View style={styles.activeSearchRow}>
          <Text style={styles.activeSearchText} numberOfLines={1}>
            Results for “{appliedSearch}”
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              setAppliedSearch('');
            }}
          >
            <Text style={styles.clearSearch}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <TouchableOpacity
          style={[styles.chip, !language && styles.chipActive]}
          onPress={() => setLanguage(undefined)}
        >
          <Text style={[styles.chipText, !language && styles.chipTextActive]}>All languages</Text>
        </TouchableOpacity>
        {languages.map((item) => {
          const active = language === item.language;
          return (
            <TouchableOpacity
              key={item.slug}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setLanguage(active ? undefined : item.language)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.language} {item.total}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort</Text>
        {SORTS.map((option) => {
          const active = sort === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.sortChip, active && styles.sortChipActive]}
              onPress={() => setSort(option.key)}
            >
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.totalText}>
        {total > 0 ? `${total.toLocaleString()} titles` : 'Loading catalogue…'}
      </Text>

      {error && !loading ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => load(1, 'replace')}>
          <Text style={styles.errorText}>{error} — tap to retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={3}
      renderItem={({ item }) => (
        <CatalogCard
          item={item}
          width={cardWidth}
          onPress={() => Linking.openURL(item.sourceUrl).catch(() => {})}
        />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.emptyText}>
              {kind === 'movie' ? 'Koi dub movie nahi mili' : 'Koi dub series nahi mili'} — filter
              change karke dekho.
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerBox}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : null
      }
      columnWrapperStyle={styles.columnWrap}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Weekly schedule tab                                                 */
/* ------------------------------------------------------------------ */

function AiringRow({ item }: { item: DubAiring }) {
  return (
    <TouchableOpacity
      style={styles.airingRow}
      activeOpacity={0.85}
      onPress={() => Linking.openURL(item.sourceUrl).catch(() => {})}
    >
      <View style={styles.airingPosterWrap}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Text style={styles.posterPlaceholderText}>?</Text>
          </View>
        )}
      </View>

      <View style={styles.airingBody}>
        <Text style={styles.airingTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.airingMeta} numberOfLines={1}>
          {[item.season, item.episodeInfo].filter(Boolean).join(' · ') || item.sourceName}
        </Text>
        <View style={styles.langRow}>
          {item.languages.slice(0, 3).map((language) => (
            <View
              key={language}
              style={[styles.langBadge, { borderColor: `${languageTint(language)}88` }]}
            >
              <Text style={[styles.langBadgeText, { color: languageTint(language) }]}>
                {language}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.airingTime}>
        <Text style={styles.airingTimeText}>{item.timeLabel ?? 'TBA'}</Text>
        {item.releaseAt ? (
          <Text style={styles.airingDate}>{istLabel(item.releaseAt)}</Text>
        ) : (
          <Text style={styles.airingDate}>IST</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ScheduleTab() {
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState<{ title: string; data: DubAiring[] }[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.dub.weeklySchedule();
      const groups = (data?.groups || [])
        .filter((group) => group.items.length > 0)
        .map((group) => ({ title: group.day, data: group.items }));
      if (data?.unscheduled?.length) {
        groups.push({ title: 'Unscheduled', data: data.unscheduled });
      }
      setSections(groups);
      setCount(data?.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Could not load the dub schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <AiringRow item={item} />}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.tabHeader}>
          <Text style={styles.scheduleIntro}>
            Weekly Hindi &amp; regional dub airings, IST timings ke saath. {count} airings tracked.
          </Text>
          {error ? (
            <TouchableOpacity style={styles.errorBox} onPress={load}>
              <Text style={styles.errorText}>{error} — tap to retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>
            Is hafte koi airing track nahi hui. Next sync ke baad yahan schedule aa jayega.
          </Text>
        </View>
      }
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Languages tab                                                       */
/* ------------------------------------------------------------------ */

function LanguagesTab({
  languages,
  onBrowse,
}: {
  languages: DubLanguageStat[];
  onBrowse: (language: string, kind: 'series' | 'movie') => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      data={languages}
      keyExtractor={(item) => item.slug}
      renderItem={({ item }) => (
        <View style={styles.languageCard}>
          <View style={[styles.languageDot, { backgroundColor: languageTint(item.language) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.languageName}>{item.language}</Text>
            <Text style={styles.languageMeta}>
              {item.total.toLocaleString()} titles · {item.series.toLocaleString()} series ·{' '}
              {item.movies.toLocaleString()} movies
            </Text>
          </View>
          <TouchableOpacity style={styles.languageAction} onPress={() => onBrowse(item.language, 'series')}>
            <Text style={styles.languageActionText}>Series</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.languageAction} onPress={() => onBrowse(item.language, 'movie')}>
            <Text style={styles.languageActionText}>Movies</Text>
          </TouchableOpacity>
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.tabHeader}>
          <Text style={styles.scheduleIntro}>
            Har language ke saare dubbed titles. Source sites par naya dub aate hi count update hota
            hai.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>Languages load ho rahi hain…</Text>
        </View>
      }
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function HindiDubScreen() {
  const [tab, setTab] = useState<TabKey>('series');
  const [languages, setLanguages] = useState<DubLanguageStat[]>([]);
  const [browseLanguage, setBrowseLanguage] = useState<string | undefined>(undefined);
  const { colors: themeColors } = useTheme();

  useEffect(() => {
    let active = true;
    api.dub
      .languages()
      .then((list) => {
        if (active) setLanguages(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const subtitle = useMemo(() => {
    if (!languages.length) return 'Series, movies & weekly airings';
    const total = languages.reduce((sum, item) => sum + item.total, 0);
    return `${total.toLocaleString()} titles · ${languages.length} languages`;
  }, [languages]);

  const browse = useCallback((language: string, kind: 'series' | 'movie') => {
    setBrowseLanguage(language);
    setTab(kind === 'movie' ? 'movies' : 'series');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScreenHeader title="Hindi Dub Library" subtitle={subtitle} emoji="🇮🇳" />

      <View style={styles.tabBar}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setTab(item.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'series' ? (
        <CatalogTab
          kind="series"
          languages={languages}
          initialLanguage={browseLanguage}
          onClearInitialLanguage={() => setBrowseLanguage(undefined)}
        />
      ) : null}
      {tab === 'movies' ? (
        <CatalogTab
          kind="movie"
          languages={languages}
          initialLanguage={browseLanguage}
          onClearInitialLanguage={() => setBrowseLanguage(undefined)}
        />
      ) : null}
      {tab === 'schedule' ? <ScheduleTab /> : null}
      {tab === 'languages' ? <LanguagesTab languages={languages} onBrowse={browse} /> : null}
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  tabHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.sm,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#0a0a0f',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  activeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  activeSearchText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  clearSearch: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  chipRow: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}22`,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.text,
    fontWeight: '800',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sortLabel: {
    color: colors.textDim,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  sortChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sortChipActive: {
    borderColor: colors.secondary,
  },
  sortChipText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: colors.secondary,
    fontWeight: '800',
  },
  totalText: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  columnWrap: {
    gap: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  posterWrap: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  posterPlaceholderText: {
    color: colors.textDim,
    fontSize: 10,
    textAlign: 'center',
  },
  kindBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(10,10,15,0.8)',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  kindBadgeText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(10,10,15,0.8)',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ratingText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '800',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 3,
  },
  langBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 4,
  },
  langBadgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  moreLangs: {
    color: colors.textDim,
    fontSize: 8,
    alignSelf: 'center',
  },
  cardMeta: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  footerBox: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.error}66`,
    backgroundColor: `${colors.error}18`,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  scheduleIntro: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  sectionCount: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  airingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  airingPosterWrap: {
    width: 44,
    height: 64,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  airingBody: {
    flex: 1,
  },
  airingTitle: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: 16,
  },
  airingMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  airingTime: {
    alignItems: 'flex-end',
    maxWidth: 110,
  },
  airingTimeText: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  airingDate: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
    textAlign: 'right',
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  languageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  languageName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  languageMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  languageAction: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  languageActionText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
}));
