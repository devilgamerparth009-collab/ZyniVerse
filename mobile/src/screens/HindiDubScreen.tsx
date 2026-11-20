import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  FlatList,
  SectionList,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { DubAiring, DubCatalogTitle, DubGenreStat, DubLanguageStat } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import SafeImage from '../components/SafeImage';
import AnimatedTabBar, { type AnimatedTabItem } from '../components/AnimatedTabBar';
import { SkeletonBlock } from '../components/Skeletons';
import { useTheme } from '../hooks/useTheme';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { openSafeWebUrl } from '../utils/safeLinks';

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

type TabKey = 'all' | 'series' | 'movies' | 'schedule' | 'languages' | 'genres';

const TABS: AnimatedTabItem<TabKey>[] = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'series', label: 'Series', emoji: '📺' },
  { key: 'movies', label: 'Movies', emoji: '🎬' },
  { key: 'schedule', label: 'Schedule', emoji: '🗓' },
  { key: 'languages', label: 'Languages', emoji: '🌐' },
  { key: 'genres', label: 'Genres', emoji: '🎭' },
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

function todayLabel(): string {
  return DAY_NAMES[new Date(Date.now() + IST_OFFSET_MS).getUTCDay()];
}

function languageTint(language: string): string {
  return LANG_TINT[language] ?? '#8b5cf6';
}

function openDubSource(url?: string | null) {
  // Open trusted official platform links directly; keep unknown/external sites on ZyniVerse pages.
  openSafeWebUrl(url, '/hindi-dub');
}

/* ------------------------------------------------------------------ */
/* Catalogue tab (all / series / movies)                                */
/* ------------------------------------------------------------------ */

function CatalogListSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 9 }, (_, index) => (
        <View key={index} style={styles.skeletonTile}>
          <SkeletonBlock height={132} radius={borderRadius.md} />
          <SkeletonBlock height={12} style={styles.skeletonGap} />
          <SkeletonBlock height={10} width="65%" style={styles.skeletonTightGap} />
        </View>
      ))}
    </View>
  );
}

function CatalogCard({
  item,
  width,
  index,
  onPress,
}: {
  item: DubCatalogTitle;
  width: number;
  index: number;
  onPress: () => void;
}) {
  return (
    <FadeInView delay={Math.min(index, 9) * 45} offset={10}>
      <PressableScale
        scaleTo={0.95}
        onPress={onPress}
        accessibilityLabel={item.title}
        style={[styles.card, { width }]}
      >
        <View style={styles.posterWrap}>
          <SafeImage
            uri={item.posterUrl}
            fallbackLabel={item.title}
            style={styles.poster}
            accessibilityLabel={item.title}
          />
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
      </PressableScale>
    </FadeInView>
  );
}

function CatalogTab({
  kind,
  languages,
  genres,
  tint,
  initialLanguage,
  initialGenre,
  onClearInitial,
  header,
}: {
  kind?: 'series' | 'movie';
  languages: DubLanguageStat[];
  genres: DubGenreStat[];
  tint: string;
  initialLanguage?: string;
  initialGenre?: string;
  onClearInitial: () => void;
  header?: ReactNode;
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
  const [genre, setGenre] = useState<string | undefined>(initialGenre);
  const [sort, setSort] = useState<'recent' | 'title' | 'rating' | 'year'>('recent');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (initialLanguage || initialGenre) {
      setLanguage(initialLanguage);
      setGenre(initialGenre);
      onClearInitial();
    }
    // Only react to explicit browse requests from the Languages / Genres tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLanguage, initialGenre]);

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
          genre,
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
        setError(e?.message || 'Could not load the catalogue');
      } finally {
        if (requestId.current === id) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [kind, language, genre, appliedSearch, sort, refreshing]
  );

  useEffect(() => {
    load(1, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, language, genre, appliedSearch, sort]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, 'replace');
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    load(page + 1, 'append');
  }, [loading, loadingMore, page, totalPages, load]);

  const filters = (
    <View style={styles.tabHeader}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${kind === 'movie' ? 'movies' : kind === 'series' ? 'series' : 'dubs'}…`}
          placeholderTextColor={colors.textDim}
          returnKeyType="search"
          onSubmitEditing={() => setAppliedSearch(search.trim())}
        />
        <PressableScale
          scaleTo={0.92}
          onPress={() => setAppliedSearch(search.trim())}
          style={[styles.searchButton, { backgroundColor: tint }]}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </PressableScale>
      </View>

      {appliedSearch ? (
        <View style={styles.activeSearchRow}>
          <Text style={styles.activeSearchText} numberOfLines={1}>
            Results for “{appliedSearch}”
          </Text>
          <PressableScale scaleTo={0.9} onPress={() => {
            setSearch('');
            setAppliedSearch('');
          }}>
            <Text style={styles.clearSearch}>Clear</Text>
          </PressableScale>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <PressableScale
          scaleTo={0.94}
          style={[styles.chip, !language && styles.chipActive]}
          onPress={() => setLanguage(undefined)}
        >
          <Text style={[styles.chipText, !language && styles.chipTextActive]}>All languages</Text>
        </PressableScale>
        {languages.map((item) => {
          const active = language === item.language;
          return (
            <PressableScale
              key={item.slug}
              scaleTo={0.94}
              style={[styles.chip, active && [styles.chipActive, { borderColor: tint }]]}
              onPress={() => setLanguage(active ? undefined : item.language)}
            >
              <Text style={[styles.chipText, active && [styles.chipTextActive, { color: tint }]]}>
                {item.language} {item.total.toLocaleString()}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <PressableScale
          scaleTo={0.94}
          style={[styles.chip, !genre && styles.chipActive]}
          onPress={() => setGenre(undefined)}
        >
          <Text style={[styles.chipText, !genre && styles.chipTextActive]}>All genres</Text>
        </PressableScale>
        {genres.map((item) => {
          const active = genre === item.genre;
          return (
            <PressableScale
              key={item.genre}
              scaleTo={0.94}
              style={[styles.chip, active && [styles.chipActive, { borderColor: tint }]]}
              onPress={() => setGenre(active ? undefined : item.genre)}
            >
              <Text style={[styles.chipText, active && [styles.chipTextActive, { color: tint }]]}>
                {item.genre} {item.total.toLocaleString()}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort</Text>
        {SORTS.map((option) => {
          const active = sort === option.key;
          return (
            <PressableScale
              key={option.key}
              scaleTo={0.92}
              style={[styles.sortChip, active && [styles.sortChipActive, { borderColor: tint }]]}
              onPress={() => setSort(option.key)}
            >
              <Text
                style={[styles.sortChipText, active && [styles.sortChipTextActive, { color: tint }]]}
              >
                {option.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <Text style={styles.totalText}>
        {loading && items.length === 0
          ? 'Loading catalogue…'
          : total > 0
            ? `${total.toLocaleString()} titles`
            : 'No titles yet'}
      </Text>

      {error && !loading ? (
        <PressableScale scaleTo={0.98} style={styles.errorBox} onPress={() => load(1, 'replace')}>
          <Text style={styles.errorText}>{error} — tap to retry</Text>
        </PressableScale>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={3}
      renderItem={({ item, index }) => (
        <CatalogCard item={item} width={cardWidth} index={index} onPress={() => openDubSource(item.sourceUrl)} />
      )}
      ListHeaderComponent={
        <>
          {header}
          {filters}
        </>
      }
      ListEmptyComponent={
        loading ? (
          <CatalogListSkeleton />
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.emptyText}>
              No dubbed titles matched those filters. Try another language or genre.
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        loadingMore || (loading && items.length > 0) ? (
          <View style={styles.footerBox}>
            <ActivityIndicator color={tint} size="small" />
          </View>
        ) : null
      }
      columnWrapperStyle={styles.columnWrap}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Weekly schedule tab                                                  */
/* ------------------------------------------------------------------ */

function ScheduleSkeleton() {
  return (
    <View style={styles.scheduleSkeleton}>
      {[0, 1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.scheduleSkeletonRow}>
          <SkeletonBlock width={48} height={68} radius={borderRadius.sm} />
          <View style={styles.scheduleSkeletonBody}>
            <SkeletonBlock height={13} width="82%" />
            <SkeletonBlock height={10} width="55%" style={styles.skeletonTightGap} />
            <SkeletonBlock height={10} width="40%" style={styles.skeletonTightGap} />
          </View>
          <SkeletonBlock height={28} width={64} radius={borderRadius.sm} />
        </View>
      ))}
    </View>
  );
}

function countdownFrom(releaseAt: string | null, now: number) {
  if (!releaseAt) return null;
  const release = new Date(releaseAt).getTime();
  if (!Number.isFinite(release)) return null;
  const distance = Math.max(0, release - now);
  return {
    released: distance === 0,
    parts: [
      { label: 'Days', value: Math.floor(distance / 86_400_000) },
      { label: 'Hrs', value: Math.floor((distance % 86_400_000) / 3_600_000) },
      { label: 'Min', value: Math.floor((distance % 3_600_000) / 60_000) },
      { label: 'Sec', value: Math.floor((distance % 60_000) / 1000) },
    ],
  };
}

function AiringRow({
  item,
  tint,
  index,
  now,
}: {
  item: DubAiring;
  tint: string;
  index: number;
  now: number;
}) {
  const countdown = countdownFrom(item.releaseAt, now);
  const meta = [item.season, item.episodeInfo].filter(Boolean).join(' · ');

  return (
    <FadeInView delay={Math.min(index, 10) * 40} offset={8}>
      <PressableScale
        scaleTo={0.99}
        onPress={() => openDubSource(item.sourceUrl)}
        accessibilityLabel={item.title}
        style={styles.airingCard}
      >
        <View style={styles.airingTop}>
          <SafeImage
            uri={item.posterUrl}
            fallbackLabel={item.title}
            style={styles.airingPosterWrap}
            accessibilityLabel={item.title}
          />

          <View style={styles.airingBody}>
            <Text style={styles.airingTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {meta ? (
              <View style={styles.airingMetaRow}>
                {item.season ? (
                  <View style={[styles.metaPill, { borderColor: `${tint}55` }]}>
                    <Text style={[styles.metaPillText, { color: tint }]}>{item.season}</Text>
                  </View>
                ) : null}
                {item.episodeInfo ? (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{item.episodeInfo}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.airingMeta} numberOfLines={1}>
              {item.dayLabel ?? 'This week'} · {item.timeLabel ?? 'TBA'} · IST
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
        </View>

        <View style={[styles.airingCountdownPanel, { borderColor: `${tint}33` }]}>
          <Text style={[styles.airingCountdownLabel, { color: tint }]}>
            {countdown ? (countdown.released ? 'AIRING NOW' : 'NEXT EPISODE') : 'TIME TBA'}
          </Text>
          {countdown && !countdown.released ? (
            <View style={styles.countdownRow}>
              {countdown.parts.map((part) => (
                <View key={part.label} style={styles.countdownBox}>
                  <Text style={styles.countdownValue}>{pad(part.value)}</Text>
                  <Text style={styles.countdownLabel}>{part.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.airingTba}>
              {countdown?.released
                ? 'Released — open for details'
                : 'Unscheduled — time to be announced'}
            </Text>
          )}
          <Text style={styles.airingDate}>
            {item.releaseAt ? istLabel(item.releaseAt) : item.dayLabel ?? 'This week'}
          </Text>
        </View>
      </PressableScale>
    </FadeInView>
  );
}

type ScheduleView = 'week' | 'tonight';

function ScheduleTab({ tint, header }: { tint: string; header?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ScheduleView>('week');
  const [sections, setSections] = useState<{ title: string; data: DubAiring[] }[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.dub.weeklySchedule();
      const tonight = todayLabel();
      const todayIdx = DAY_NAMES.indexOf(tonight);
      const groups = (data?.groups || [])
        .filter((group) => group.items.length > 0)
        .filter((group) => view !== 'tonight' || group.day === tonight || group.day === 'Daily')
        .map((group) => ({ title: group.day, data: group.items }));

      if (view === 'week') {
        groups.sort((a, b) => {
          const ai = DAY_NAMES.indexOf(a.title);
          const bi = DAY_NAMES.indexOf(b.title);
          const aOffset = ai < 0 ? (a.title === 'Daily' ? -1 : 99) : (ai - todayIdx + 7) % 7;
          const bOffset = bi < 0 ? (b.title === 'Daily' ? -1 : 99) : (bi - todayIdx + 7) % 7;
          return aOffset - bOffset;
        });
        if (data?.unscheduled?.length) {
          groups.push({ title: 'Unscheduled', data: data.unscheduled });
        }
      }

      setSections(groups);
      setCount(groups.reduce((sum, group) => sum + group.data.length, 0));
    } catch (e: any) {
      setError(e?.message || 'Could not load the schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  const headerContent = (
    <>
      <Text style={styles.scheduleIntro}>
        Hindi and regional dub airings across the week, shown in IST. Times and new episodes
        refresh automatically from the published schedule.{' '}
        {error ? 'Schedule updates are temporarily unavailable.' : `${count} airings tracked.`}
      </Text>
      <View style={styles.viewToggle}>
        {(['week', 'tonight'] as ScheduleView[]).map((option) => {
          const active = view === option;
          return (
            <PressableScale
              key={option}
              scaleTo={0.94}
              style={[styles.viewChip, active && [styles.viewChipActive, { borderColor: tint }]]}
              onPress={() => setView(option)}
            >
              <Text
                style={[styles.viewChipText, active && [styles.viewChipTextActive, { color: tint }]]}
              >
                {option === 'week' ? 'Full week' : `Tonight · ${todayLabel()}`}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      {error ? (
        <PressableScale scaleTo={0.98} style={styles.errorBox} onPress={load}>
          <Text style={styles.errorText}>{error} — tap to retry</Text>
        </PressableScale>
      ) : null}
    </>
  );
  const scheduleHeader = <View style={styles.tabHeader}>{headerContent}</View>;

  if (loading) {
    return (
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {header}
        <View style={[styles.tabHeader, { paddingHorizontal: spacing.md }]}>{headerContent}</View>
        <ScheduleSkeleton />
      </ScrollView>
    );
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <AiringRow item={item} tint={tint} index={index} now={now} />
      )}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      ListHeaderComponent={
        <>
          {header}
          {scheduleHeader}
        </>
      }
      ListEmptyComponent={
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>
            {error
              ? 'Schedule updates are not available right now. Pull to refresh in a moment.'
              : view === 'tonight'
                ? 'Nothing scheduled for tonight. Check the full week.'
                : 'No airings tracked this week. Check back after the next update.'}
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
          tintColor={tint}
        />
      }
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Languages / Genres tabs                                              */
/* ------------------------------------------------------------------ */

function LanguagesTab({
  languages,
  tint,
  loading,
  onBrowse,
  header,
}: {
  languages: DubLanguageStat[];
  tint: string;
  loading: boolean;
  onBrowse: (language: string) => void;
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {header}
        <View style={[styles.tabHeader, { paddingHorizontal: spacing.md }]}>
          <Text style={styles.scheduleIntro}>
            Browse every dubbed title by language. Counts update as new dubs are added.
          </Text>
        </View>
        <View style={styles.simpleSkeleton}>
          {[0, 1, 2, 3, 4].map((item) => (
            <SkeletonBlock key={item} height={64} radius={borderRadius.md} />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={languages}
      keyExtractor={(item) => item.slug}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 10) * 40} offset={8}>
          <PressableScale
            scaleTo={0.97}
            style={styles.languageCard}
            onPress={() => onBrowse(item.language)}
          >
            <View style={[styles.languageDot, { backgroundColor: languageTint(item.language) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.languageName}>{item.language}</Text>
              <Text style={styles.languageMeta}>
                {item.total.toLocaleString()} titles · {item.series.toLocaleString()} series ·{' '}
                {item.movies.toLocaleString()} movies
              </Text>
            </View>
            <View style={[styles.languageAction, { borderColor: `${tint}66` }]}>
              <Text style={[styles.languageActionText, { color: tint }]}>Browse</Text>
            </View>
          </PressableScale>
        </FadeInView>
      )}
      ListHeaderComponent={
        <>
          {header}
          <View style={styles.tabHeader}>
            <Text style={styles.scheduleIntro}>
              Browse every dubbed title by language. Counts update as new dubs are added.
            </Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>No languages available yet.</Text>
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

function GenresTab({
  genres,
  tint,
  loading,
  onBrowse,
  header,
}: {
  genres: DubGenreStat[];
  tint: string;
  loading: boolean;
  onBrowse: (genre: string) => void;
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {header}
        <View style={[styles.tabHeader, { paddingHorizontal: spacing.md }]}>
          <Text style={styles.scheduleIntro}>
            Explore titles by genre. Tap any genre to see everything in it.
          </Text>
        </View>
        <View style={[styles.skeletonGrid, { paddingHorizontal: spacing.md }]}>
          {[0, 1, 2, 3].map((item) => (
            <SkeletonBlock key={item} height={64} radius={borderRadius.md} style={styles.skeletonTile} />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={genres}
      keyExtractor={(item) => item.genre}
      numColumns={2}
      columnWrapperStyle={styles.columnWrap}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 10) * 40} offset={8}>
          <PressableScale
            scaleTo={0.96}
            style={styles.genreCard}
            onPress={() => onBrowse(item.genre)}
          >
            <View style={[styles.genreIcon, { backgroundColor: `${tint}22` }]}>
              <Text style={[styles.genreIconText, { color: tint }]}>{item.genre.slice(0, 1)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.genreName} numberOfLines={1}>
                {item.genre}
              </Text>
              <Text style={styles.genreMeta}>
                {item.total.toLocaleString()} titles · {item.series.toLocaleString()} series ·{' '}
                {item.movies.toLocaleString()} movies
              </Text>
            </View>
          </PressableScale>
        </FadeInView>
      )}
      ListHeaderComponent={
        <>
          {header}
          <View style={styles.tabHeader}>
            <Text style={styles.scheduleIntro}>
              Explore titles by genre. Tap any genre to see everything in it.
            </Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.loadingBox}>
          <Text style={styles.emptyText}>No genres available yet.</Text>
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
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isLaunch, isChristmas } = useTheme();
  const tint = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : colors.primary;

  const requestedTab = route.params?.tab as TabKey | undefined;
  const initialTab = requestedTab && TABS.some((item) => item.key === requestedTab) ? requestedTab : 'all';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [languages, setLanguages] = useState<DubLanguageStat[]>([]);
  const [genres, setGenres] = useState<DubGenreStat[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; languageCount: number } | null>(null);
  const [browse, setBrowse] = useState<{ language?: string; genre?: string }>({});
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  useEffect(() => {
    let active = true;
    (async () => {
      const overview = await api.dub.overview().catch(() => null);
      if (!active) return;
      if (overview) {
        setLanguages(overview.languages || []);
        setGenres(overview.genres || []);
        setStats({ total: overview.total, languageCount: overview.languageCount });
        setOverviewLoading(false);
        return;
      }
      const [langs, gnrs] = await Promise.all([
        api.dub.languages().catch(() => [] as DubLanguageStat[]),
        api.dub.genres().catch(() => [] as DubGenreStat[]),
      ]);
      if (!active) return;
      setLanguages(langs);
      setGenres(gnrs);
      setOverviewLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (requestedTab && TABS.some((item) => item.key === requestedTab)) setTab(requestedTab);
  }, [requestedTab]);

  const heroStats = useMemo(() => {
    const total = stats?.total ?? languages.reduce((sum, item) => sum + item.total, 0);
    const languageCount = stats?.languageCount ?? languages.length;
    return [
      { label: 'Titles', value: total.toLocaleString(), delay: 80 },
      { label: 'Languages', value: languageCount.toLocaleString(), delay: 120 },
      { label: 'Genres', value: genres.length.toLocaleString(), delay: 160 },
    ];
  }, [stats, languages, genres.length]);

  const subtitle = useMemo(() => {
    if (stats) return `${stats.total.toLocaleString()} titles · ${stats.languageCount} languages`;
    if (!languages.length) return 'Series, movies, schedule, languages & genres';
    const total = languages.reduce((sum, item) => sum + item.total, 0);
    return `${total.toLocaleString()} titles · ${languages.length} languages`;
  }, [languages, stats]);

  const browseLanguage = useCallback((language: string) => {
    setBrowse({ language, genre: undefined });
    setTab('all');
  }, []);

  const browseGenre = useCallback((genre: string) => {
    setBrowse({ language: undefined, genre });
    setTab('all');
  }, []);

  const clearBrowse = useCallback(() => setBrowse({}), []);

  const headerRight = (
    <PressableScale
      scaleTo={0.92}
      style={[styles.profileButton, { borderColor: `${tint}88` }]}
      onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
    >
      <Text style={[styles.profileButtonText, { color: tint }]}>Profile</Text>
    </PressableScale>
  );

  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
    transform: [
      {
        translateX: glow.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] }),
      },
      {
        scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }),
      },
    ],
  };

  // The hero and tabs live inside each tab's scrollable header, so they scroll
  // away naturally instead of staying pinned while the list moves underneath.
  const sharedHeader = (
    <>
      <FadeInView delay={20}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: `${tint}44` }]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.heroGlow, { backgroundColor: `${tint}22` }, glowStyle]}
          />
          <Text style={[styles.heroEyebrow, { color: tint }]}>DUB HUB</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Dubbed favourites, all in one place
          </Text>
          <Text style={[styles.heroSub, { color: colors.textMuted }]}>
            Browse series, films and weekly airings across the languages you love. Filter by
            language, genre or release order.
          </Text>
          <View style={styles.heroStats}>
            {heroStats.map((stat) => (
              <FadeInView key={stat.label} delay={stat.delay} style={styles.heroStatWrap}>
                <View style={[styles.heroStat, { borderColor: colors.border, backgroundColor: `${tint}0f` }]}>
                  <Text style={[styles.heroStatValue, { color: tint }]}>{stat.value}</Text>
                  <Text style={[styles.heroStatLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                </View>
              </FadeInView>
            ))}
          </View>
        </View>
      </FadeInView>

      <AnimatedTabBar<TabKey>
        tabs={TABS}
        active={tab}
        onChange={setTab}
        tint={tint}
        surface={colors.surface}
        border={colors.border}
        muted={colors.textMuted}
        scroll
        contentContainerStyle={{ marginTop: spacing.sm, paddingBottom: spacing.xs }}
      />
    </>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Dub Hub" subtitle={subtitle} emoji="🇮🇳" accent={tint} right={headerRight} />

      {tab === 'all' || tab === 'series' || tab === 'movies' ? (
        <CatalogTab
          kind={tab === 'series' ? 'series' : tab === 'movies' ? 'movie' : undefined}
          languages={languages}
          genres={genres}
          tint={tint}
          initialLanguage={browse.language}
          initialGenre={browse.genre}
          onClearInitial={clearBrowse}
          header={sharedHeader}
        />
      ) : null}
      {tab === 'schedule' ? <ScheduleTab tint={tint} header={sharedHeader} /> : null}
      {tab === 'languages' ? (
        <LanguagesTab
          languages={languages}
          tint={tint}
          loading={overviewLoading}
          onBrowse={browseLanguage}
          header={sharedHeader}
        />
      ) : null}
      {tab === 'genres' ? (
        <GenresTab
          genres={genres}
          tint={tint}
          loading={overviewLoading}
          onBrowse={browseGenre}
          header={sharedHeader}
        />
      ) : null}
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  heroEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: '900',
    lineHeight: 28,
    marginTop: spacing.xs + 2,
  },
  heroSub: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.xs + 2,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroStatWrap: {
    flex: 1,
  },
  heroStat: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: fontSize.lg,
    fontWeight: '900',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  profileButton: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  profileButtonText: {
    fontSize: fontSize.xs,
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
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontSize: fontSize.sm,
  },
  searchButton: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#0a0a0f',
    fontSize: fontSize.xs,
    fontWeight: '900',
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
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: `${colors.primary}22`,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.text,
    fontWeight: '900',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm + 2,
  },
  sortLabel: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  sortChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  sortChipActive: {
    backgroundColor: `${colors.secondary}18`,
  },
  sortChipText: {
    color: colors.textDim,
    fontSize: 11.5,
    fontWeight: '700',
  },
  sortChipTextActive: {
    fontWeight: '900',
  },
  totalText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: spacing.sm + 2,
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
  kindBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(10,10,15,0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  kindBadgeText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(10,10,15,0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    color: colors.warning,
    fontSize: 10.5,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 5,
  },
  langBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  langBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  moreLangs: {
    color: colors.textDim,
    fontSize: 9.5,
    alignSelf: 'center',
  },
  cardMeta: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 3,
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
    lineHeight: 21,
  },
  errorBox: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.error}66`,
    backgroundColor: `${colors.error}18`,
    padding: spacing.sm + 2,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  scheduleIntro: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm + 2,
  },
  viewChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 7,
  },
  viewChipActive: {
    backgroundColor: `${colors.secondary}18`,
  },
  viewChipText: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  viewChipTextActive: {
    fontWeight: '900',
  },
  scheduleSkeleton: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  scheduleSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scheduleSkeletonBody: {
    flex: 1,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  skeletonTile: {
    width: '31%',
  },
  skeletonGap: {
    marginTop: spacing.sm,
  },
  skeletonTightGap: {
    marginTop: spacing.xs + 2,
  },
  simpleSkeleton: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
    fontWeight: '900',
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
    fontSize: 11,
    fontWeight: '800',
  },
  list: {
    flex: 1,
  },
  airingCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    gap: spacing.sm + 2,
  },
  airingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  airingPosterWrap: {
    width: 58,
    height: 84,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  airingBody: {
    flex: 1,
  },
  airingTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '900',
    lineHeight: 21,
  },
  airingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs + 2,
  },
  metaPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaPillText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  airingMeta: {
    color: colors.textDim,
    fontSize: 11.5,
    marginTop: spacing.xs + 2,
  },
  airingCountdownPanel: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  airingCountdownLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  countdownBox: {
    width: 58,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    alignItems: 'center',
  },
  countdownValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  countdownLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  airingTba: {
    color: colors.warning,
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  airingDate: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  languageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  languageName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '900',
  },
  languageMeta: {
    color: colors.textDim,
    fontSize: 11.5,
    marginTop: 2,
  },
  languageAction: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  languageActionText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  genreCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  genreIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genreIconText: {
    fontSize: 16,
    fontWeight: '900',
  },
  genreName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
  genreMeta: {
    color: colors.textDim,
    fontSize: 10.5,
    marginTop: 2,
  },
}));
