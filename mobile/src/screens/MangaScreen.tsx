import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { Anime, MangaChapter, MangaEntry, User } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';
import { animePoster, animeTitle, formatScore, getScoreColor } from '../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - 12) / 2;

const CATALOG_TABS = [
  { key: 'trending', label: 'Trending' },
  { key: 'popular', label: 'Popular' },
  { key: 'top', label: 'Top rated' },
] as const;

const TYPES = [
  { key: '', label: 'All' },
  { key: 'manga', label: 'Manga' },
  { key: 'manhwa', label: 'Manhwa' },
  { key: 'manhua', label: 'Manhua' },
  { key: 'light_novel', label: 'Light novel' },
] as const;

const STATUSES = [
  { key: 'ALL', label: 'All', color: '#94a3b8' },
  { key: 'READING', label: 'Reading', color: '#22c55e' },
  { key: 'PLANNING', label: 'Planning', color: '#f59e0b' },
  { key: 'COMPLETED', label: 'Completed', color: '#3b82f6' },
  { key: 'PAUSED', label: 'Paused', color: '#94a3b8' },
  { key: 'DROPPED', label: 'Dropped', color: '#ef4444' },
] as const;

function statusColor(status?: string) {
  return STATUSES.find((s) => s.key === status)?.color || '#94a3b8';
}

function progressOf(entry: MangaEntry): number {
  if (!entry.totalChapters) return 0;
  return Math.min(1, Math.max(0, entry.chapters / entry.totalChapters));
}

export default function MangaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch, isChristmas } = useTheme();
  const tint = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : '#f472b6';

  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');

  // Discover
  const [catalogTab, setCatalogTab] = useState<'trending' | 'popular' | 'top'>('trending');
  const [type, setType] = useState<string>('');
  const [catalog, setCatalog] = useState<Anime[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // My list
  const [entries, setEntries] = useState<MangaEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [mineLoading, setMineLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Detail sheet
  const [selected, setSelected] = useState<Anime | null>(null);
  const [detailEntry, setDetailEntry] = useState<MangaEntry | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      setCatalogError(null);
      const list = await api.manga.catalog(catalogTab, 24, type || undefined);
      setCatalog(list);
    } catch (e: any) {
      setCatalogError(e?.message || 'Could not load the manga catalog');
    } finally {
      setCatalogLoading(false);
      setRefreshing(false);
    }
  }, [catalogTab, type]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setCounts({});
      return;
    }
    try {
      setMineLoading(true);
      const data = await api.manga.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        q: query.trim() || undefined,
        perPage: 48,
      });
      setEntries(data.entries || []);
      setCounts(data.counts || {});
    } catch {
      setEntries([]);
    } finally {
      setMineLoading(false);
      setRefreshing(false);
    }
  }, [user, statusFilter, query]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (tab === 'mine') loadMine();
  }, [tab, loadMine]);

  const openDetail = async (anime: Anime) => {
    setSelected(anime);
    setDetailEntry(null);
    setChapters([]);
    setActionError(null);
    if (!user) return;
    setDetailLoading(true);
    try {
      const data = await api.manga.chapters(anime.id);
      setDetailEntry(data.entry);
      setChapters(data.chapters);
    } catch {
      // no entry yet — that is the normal case for a fresh title
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailEntry(null);
    setChapters([]);
    setActionError(null);
    setBusy(null);
  };

  const refreshDetail = async (mediaId: number) => {
    try {
      const data = await api.manga.chapters(mediaId);
      setDetailEntry(data.entry);
      setChapters(data.chapters);
    } catch {}
  };

  const saveStatus = async (status: string) => {
    if (!selected || !user) {
      navigation.navigate('Login');
      return;
    }
    setBusy(status);
    setActionError(null);
    try {
      const entry = await api.manga.save({
        mediaId: selected.id,
        title: animeTitle(selected),
        coverImage: animePoster(selected),
        status,
        chapters: detailEntry?.chapters ?? 0,
        volumes: detailEntry?.volumes ?? 0,
        totalChapters: selected.chapters ?? detailEntry?.totalChapters ?? null,
        totalVolumes: selected.volumes ?? detailEntry?.totalVolumes ?? null,
        score: detailEntry?.score ?? null,
        subType: type || undefined,
      });
      setDetailEntry(entry);
      await refreshDetail(selected.id);
      if (tab === 'mine') loadMine();
    } catch (e: any) {
      setActionError(e?.message || 'Could not save this title');
    } finally {
      setBusy(null);
    }
  };

  const markNext = async () => {
    if (!selected || !user) {
      navigation.navigate('Login');
      return;
    }
    const next = (detailEntry?.chapters || 0) + 1;
    setBusy('next');
    setActionError(null);
    try {
      // Toggle first so the chapter row is recorded, then save the entry so the
      // progress counter always moves forward even when the row already existed
      // (e.g. after stepping back).
      await api.manga
        .toggleChapter({ mediaId: selected.id, chapter: next, read: true })
        .catch(() => undefined);
      const saved = await api.manga.save({
        mediaId: selected.id,
        title: animeTitle(selected),
        coverImage: animePoster(selected),
        status: detailEntry?.status || 'READING',
        chapters: next,
        volumes: detailEntry?.volumes ?? 0,
        totalChapters: selected.chapters ?? detailEntry?.totalChapters ?? null,
        totalVolumes: selected.volumes ?? detailEntry?.totalVolumes ?? null,
        score: detailEntry?.score ?? null,
        subType: type || undefined,
      });
      setDetailEntry(saved);
      await refreshDetail(selected.id);
      if (tab === 'mine') loadMine();
    } catch (e: any) {
      setActionError(e?.message || 'Could not update progress');
    } finally {
      setBusy(null);
    }
  };

  const stepBack = async () => {
    if (!selected || !detailEntry || !user) return;
    const prev = Math.max(0, detailEntry.chapters - 1);
    setBusy('prev');
    setActionError(null);
    try {
      const entry = await api.manga.save({
        mediaId: selected.id,
        title: detailEntry.title,
        coverImage: detailEntry.coverImage,
        status: detailEntry.status,
        chapters: prev,
        volumes: detailEntry.volumes,
        totalChapters: detailEntry.totalChapters,
        totalVolumes: detailEntry.totalVolumes,
        score: detailEntry.score,
      });
      setDetailEntry(entry);
      if (tab === 'mine') loadMine();
    } catch (e: any) {
      setActionError(e?.message || 'Could not update progress');
    } finally {
      setBusy(null);
    }
  };

  const toggleChapterRead = async (chapter: MangaChapter) => {
    if (!selected) return;
    setBusy(`ch-${chapter.chapter}`);
    try {
      await api.manga.toggleChapter({
        mediaId: selected.id,
        chapter: chapter.chapter,
        title: chapter.title,
        read: !chapter.read,
      });
      await refreshDetail(selected.id);
      if (tab === 'mine') loadMine();
    } catch (e: any) {
      setActionError(e?.message || 'Could not update the chapter');
    } finally {
      setBusy(null);
    }
  };

  const removeEntry = async () => {
    if (!selected) return;
    setBusy('remove');
    try {
      await api.manga.remove(selected.id);
      closeDetail();
      if (tab === 'mine') loadMine();
    } catch (e: any) {
      setActionError(e?.message || 'Could not remove this title');
    } finally {
      setBusy(null);
    }
  };

  const statusOptions = useMemo(() => STATUSES.filter((s) => s.key !== 'ALL'), []);
  const visibleChapters = useMemo(
    () => [...chapters].sort((a, b) => b.chapter - a.chapter).slice(0, 20),
    [chapters]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Manga"
        subtitle="Track every chapter, across every title"
        emoji="📚"
        accent={tint}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              tab === 'discover' ? loadCatalog() : loadMine();
            }}
            tintColor={tint}
          />
        }
      >
        {/* Mode tabs */}
        <View style={styles.modeTabs}>
          {([
            { key: 'discover', label: '🔎 Discover' },
            { key: 'mine', label: '📌 My list' },
          ] as const).map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.modeTab,
                  {
                    backgroundColor: active ? `${tint}22` : colors.surface,
                    borderColor: active ? tint : colors.border,
                  },
                ]}
              >
                <Text style={[styles.modeTabText, { color: active ? tint : colors.textMuted }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'discover' ? (
          <>
            {/* Catalog sort */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {CATALOG_TABS.map((c) => {
                const active = catalogTab === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCatalogTab(c.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tint : colors.surface,
                        borderColor: active ? tint : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#0a0a0f' : colors.textMuted }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Type filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {TYPES.map((t) => {
                const active = type === t.key;
                return (
                  <TouchableOpacity
                    key={t.key || 'all'}
                    onPress={() => setType(t.key)}
                    style={[
                      styles.typeChip,
                      { borderColor: active ? `${tint}88` : colors.border, backgroundColor: active ? `${tint}14` : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.typeChipText, { color: active ? tint : colors.textDim }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {catalogLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={tint} />
                <Text style={[styles.centerText, { color: colors.textMuted }]}>Loading manga…</Text>
              </View>
            ) : catalogError ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 34 }}>📡</Text>
                <Text style={[styles.centerTitle, { color: colors.text }]}>Catalog unavailable</Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>{catalogError}</Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={loadCatalog}>
                  <Text style={styles.primaryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : catalog.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 34 }}>📚</Text>
                <Text style={[styles.centerTitle, { color: colors.text }]}>Nothing here yet</Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>
                  Try a different filter — the catalogue may be busy right now.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {catalog.map((manga, i) => (
                  <FadeInView key={manga.id} delay={Math.min(i, 8) * 40} offset={12}>
                    <PressableScale onPress={() => openDetail(manga)} style={{ width: GRID_WIDTH }}>
                      <View style={[styles.gridCover, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {animePoster(manga) ? (
                          <Image source={{ uri: animePoster(manga) }} style={styles.gridImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.gridImage, { alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 24, color: colors.textDim }}>📖</Text>
                          </View>
                        )}
                        {manga.averageScore ? (
                          <View style={[styles.gridScore, { backgroundColor: getScoreColor(manga.averageScore) }]}>
                            <Text style={styles.gridScoreText}>{formatScore(manga.averageScore)}</Text>
                          </View>
                        ) : null}
                        {manga.status ? (
                          <View style={styles.gridStatus}>
                            <Text style={styles.gridStatusText}>{manga.status}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>
                        {animeTitle(manga)}
                      </Text>
                      <Text style={[styles.gridMeta, { color: colors.textDim }]} numberOfLines={1}>
                        {[manga.format, manga.chapters ? `${manga.chapters} ch` : null, manga.seasonYear]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </PressableScale>
                  </FadeInView>
                ))}
              </View>
            )}
          </>
        ) : !user ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🔐</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>Sign in to track manga</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              Your reading list, chapter progress and scores sync with the website.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.primaryBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.textDim }}>🔍</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={loadMine}
                placeholder="Search your list"
                placeholderTextColor={colors.textDim}
                style={[styles.searchInput, { color: colors.text }]}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuery('');
                    setTimeout(loadMine, 0);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.textDim }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {STATUSES.map((s) => {
                const active = statusFilter === s.key;
                const count = s.key === 'ALL' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s.key] || 0;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setStatusFilter(s.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? `${s.color}22` : colors.surface,
                        borderColor: active ? s.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? s.color : colors.textMuted }]}>
                      {s.label}{count ? ` ${count}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {mineLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={tint} />
              </View>
            ) : entries.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 38 }}>📖</Text>
                <Text style={[styles.centerTitle, { color: colors.text }]}>Your shelf is empty</Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>
                  Add a title from Discover and it will show up here with chapter progress.
                </Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={() => setTab('discover')}>
                  <Text style={styles.primaryBtnText}>Browse manga</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.list}>
                {entries.map((entry, i) => (
                  <FadeInView key={entry.id} delay={Math.min(i, 8) * 35} offset={10}>
                    <PressableScale
                      onPress={() =>
                        openDetail({
                          id: entry.mediaId,
                          title: { romaji: entry.title, english: entry.title },
                          coverImage: entry.coverImage ? { large: entry.coverImage } : null,
                          chapters: entry.totalChapters,
                          volumes: entry.totalVolumes,
                          format: entry.subType,
                        } as any)
                      }
                      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      {entry.coverImage ? (
                        <Image source={{ uri: entry.coverImage }} style={styles.rowCover} resizeMode="cover" />
                      ) : (
                        <View style={[styles.rowCover, { backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text>📖</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                          {entry.title}
                        </Text>
                        <View style={styles.rowMetaLine}>
                          <View style={[styles.statusDot, { backgroundColor: statusColor(entry.status) }]} />
                          <Text style={[styles.rowMeta, { color: statusColor(entry.status) }]}>
                            {STATUSES.find((s) => s.key === entry.status)?.label || entry.status}
                          </Text>
                          <Text style={[styles.rowMeta, { color: colors.textDim }]}>
                            · {entry.chapters}{entry.totalChapters ? ` / ${entry.totalChapters}` : ''} ch
                          </Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: `${tint}22` }]}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${progressOf(entry) * 100}%`, backgroundColor: statusColor(entry.status) },
                            ]}
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          const next = entry.chapters + 1;
                          setBusy(`row-${entry.id}`);
                          try {
                            await api.manga
                              .toggleChapter({ mediaId: entry.mediaId, chapter: next, read: true })
                              .catch(() => undefined);
                            await api.manga.save({
                              mediaId: entry.mediaId,
                              title: entry.title,
                              coverImage: entry.coverImage,
                              status: entry.status,
                              chapters: next,
                              volumes: entry.volumes,
                              totalChapters: entry.totalChapters,
                              totalVolumes: entry.totalVolumes,
                              score: entry.score,
                              subType: entry.subType || undefined,
                            });
                            await loadMine();
                          } catch {}
                          setBusy(null);
                        }}
                        style={[styles.plusBtn, { borderColor: `${tint}66`, backgroundColor: `${tint}14` }]}
                      >
                        <Text style={[styles.plusText, { color: tint }]}>{busy === `row-${entry.id}` ? '…' : '+1'}</Text>
                      </TouchableOpacity>
                    </PressableScale>
                  </FadeInView>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Detail sheet */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeDetail} />
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            {selected && (
              <>
                <View style={styles.sheetHead}>
                  {animePoster(selected) ? (
                    <Image source={{ uri: animePoster(selected) }} style={styles.sheetCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.sheetCover, { backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text>📖</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={2}>
                      {animeTitle(selected)}
                    </Text>
                    <Text style={[styles.sheetMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {[selected.format, selected.chapters ? `${selected.chapters} ch` : null, selected.seasonYear]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                    {selected.averageScore ? (
                      <Text style={[styles.sheetScore, { color: getScoreColor(selected.averageScore) }]}>
                        ★ {(selected.averageScore / 10).toFixed(2)} / 10
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={closeDetail} hitSlop={10}>
                    <Text style={{ color: colors.textDim, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {!user ? (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: tint, marginTop: 8 }]}
                    onPress={() => {
                      closeDetail();
                      navigation.navigate('Login');
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Sign in to track this title</Text>
                  </TouchableOpacity>
                ) : (
                  <ScrollView style={{ maxHeight: 470 }} showsVerticalScrollIndicator={false}>
                    {/* Progress */}
                    <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.progressHead}>
                        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>YOUR PROGRESS</Text>
                        <Text style={[styles.progressValue, { color: tint }]}>
                          {detailEntry?.chapters || 0}
                          {detailEntry?.totalChapters || selected.chapters
                            ? ` / ${detailEntry?.totalChapters || selected.chapters}`
                            : ''}{' '}
                          chapters
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: `${tint}22` }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(detailEntry ? progressOf(detailEntry) : 0) * 100}%`,
                              backgroundColor: tint,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.stepRow}>
                        <TouchableOpacity
                          disabled={!detailEntry || busy === 'prev'}
                          onPress={stepBack}
                          style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                        >
                          <Text style={[styles.stepText, { color: detailEntry ? colors.text : colors.textDim }]}>−</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={busy === 'next'}
                          onPress={markNext}
                          style={[styles.markBtn, { backgroundColor: tint }]}
                        >
                          <Text style={styles.markBtnText}>
                            {busy === 'next' ? 'Saving…' : detailEntry ? '+ Mark next chapter read' : 'Start reading'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Status */}
                    <Text style={[styles.sheetSection, { color: colors.textMuted }]}>SHELF</Text>
                    <View style={styles.statusRow}>
                      {statusOptions.map((s) => {
                        const active = detailEntry?.status === s.key;
                        return (
                          <TouchableOpacity
                            key={s.key}
                            onPress={() => saveStatus(s.key)}
                            style={[
                              styles.statusBtn,
                              {
                                backgroundColor: active ? `${s.color}22` : colors.surface,
                                borderColor: active ? s.color : colors.border,
                              },
                            ]}
                          >
                            <Text style={[styles.statusBtnText, { color: active ? s.color : colors.textMuted }]}>
                              {busy === s.key ? '…' : s.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Chapters */}
                    {detailEntry && chapters.length > 0 && (
                      <>
                        <Text style={[styles.sheetSection, { color: colors.textMuted }]}>
                          CHAPTERS · {chapters.filter((c) => c.read).length} READ
                        </Text>
                        {visibleChapters.map((chapter) => (
                          <TouchableOpacity
                            key={chapter.id}
                            onPress={() => toggleChapterRead(chapter)}
                            style={[styles.chapterRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          >
                            <View
                              style={[
                                styles.check,
                                {
                                  borderColor: chapter.read ? '#22c55e' : colors.border,
                                  backgroundColor: chapter.read ? '#22c55e' : 'transparent',
                                },
                              ]}
                            >
                              {chapter.read && <Text style={styles.checkMark}>✓</Text>}
                            </View>
                            <Text style={[styles.chapterTitle, { color: colors.text }]} numberOfLines={1}>
                              Chapter {chapter.chapter}
                              {chapter.title ? ` · ${chapter.title}` : ''}
                            </Text>
                            {busy === `ch-${chapter.chapter}` && <ActivityIndicator size="small" color={tint} />}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}

                    {detailLoading && (
                      <View style={{ paddingVertical: 18 }}>
                        <ActivityIndicator color={tint} />
                      </View>
                    )}

                    {!!actionError && (
                      <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                    )}

                    {detailEntry && (
                      <TouchableOpacity
                        onPress={removeEntry}
                        style={[styles.removeBtn, { borderColor: `${colors.error}66` }]}
                      >
                        <Text style={[styles.removeText, { color: colors.error }]}>
                          {busy === 'remove' ? 'Removing…' : 'Remove from my list'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modeTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.md },
  modeTab: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 9, alignItems: 'center' },
  modeTabText: { fontSize: 12, fontWeight: '800' },
  chipRow: { paddingHorizontal: spacing.md, gap: 8, marginTop: spacing.md },
  chip: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: '800' },
  typeRow: { paddingHorizontal: spacing.md, gap: 6, marginTop: 8 },
  typeChip: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  typeChipText: { fontSize: 10, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  gridCover: { width: '100%', aspectRatio: 0.7, borderRadius: borderRadius.md, borderWidth: 1, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  gridScore: { position: 'absolute', left: 6, bottom: 6, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  gridScoreText: { color: '#0a0a0f', fontSize: 9.5, fontWeight: '900' },
  gridStatus: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: 'rgba(10,10,15,0.78)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  gridStatusText: { color: '#e2e8f0', fontSize: 7.5, fontWeight: '800', letterSpacing: 0.4 },
  gridTitle: { fontSize: 12, fontWeight: '700', marginTop: 7, lineHeight: 16 },
  gridMeta: { fontSize: 9.5, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 12.5, paddingVertical: 0 },
  list: { paddingHorizontal: spacing.md, gap: 10, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
  },
  rowCover: { width: 48, height: 68, borderRadius: 8 },
  rowTitle: { fontSize: 13, fontWeight: '800', lineHeight: 17 },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  rowMeta: { fontSize: 10, fontWeight: '700' },
  progressTrack: { height: 3, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  plusBtn: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  plusText: { fontSize: 11, fontWeight: '900' },
  center: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 30, gap: 8 },
  centerTitle: { fontSize: 16, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  centerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  primaryBtn: { marginTop: 10, borderRadius: borderRadius.md, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center' },
  primaryBtnText: { color: '#0a0a0f', fontSize: 12, fontWeight: '900' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.md, paddingBottom: 24 },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sheetCover: { width: 64, height: 90, borderRadius: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '900', lineHeight: 20 },
  sheetMeta: { fontSize: 10.5, marginTop: 3 },
  sheetScore: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  progressCard: { borderWidth: 1, borderRadius: borderRadius.md, padding: 12, marginTop: 14 },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  progressValue: { fontSize: 11, fontWeight: '900' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, fontWeight: '900' },
  markBtn: { flex: 1, borderRadius: borderRadius.md, paddingVertical: 10, alignItems: 'center' },
  markBtnText: { color: '#0a0a0f', fontSize: 12, fontWeight: '900' },
  sheetSection: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 16, marginBottom: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statusBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 11, paddingVertical: 5 },
  statusBtnText: { fontSize: 10.5, fontWeight: '800' },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#0a0a0f', fontSize: 11, fontWeight: '900' },
  chapterTitle: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  errorText: { fontSize: 11, marginTop: 10 },
  removeBtn: { marginTop: 16, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 10, alignItems: 'center' },
  removeText: { fontSize: 11.5, fontWeight: '800' },
});
