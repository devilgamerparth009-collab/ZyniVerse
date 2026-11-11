import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { DubEntry, DubScheduleLanguage, DubScheduleResponse } from '../types';
import { getPreferredDubLanguage } from '../services/prefs';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';

const LANGUAGES: { key: DubScheduleLanguage; label: string; color: string }[] = [
  { key: 'hindi', label: 'Hindi', color: '#ff9933' },
  { key: 'english', label: 'English', color: '#3b82f6' },
  { key: 'tamil', label: 'Tamil', color: '#e84a5f' },
  { key: 'telugu', label: 'Telugu', color: '#6c63ff' },
];

function dubTags(entry: DubEntry): { label: string; color: string }[] {
  const tags: { label: string; color: string }[] = [];
  if (entry.hasHindi) tags.push({ label: 'HI', color: '#ff9933' });
  if (entry.hasEnglish) tags.push({ label: 'EN', color: '#3b82f6' });
  if (entry.hasTamil) tags.push({ label: 'TA', color: '#e84a5f' });
  if (entry.hasTelugu) tags.push({ label: 'TE', color: '#6c63ff' });
  return tags;
}

function DubCard({
  entry,
  busy,
  onPress,
}: {
  entry: DubEntry;
  busy: boolean;
  onPress: () => void;
}) {
  const tags = dubTags(entry);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress} disabled={busy}>
      <View style={styles.posterWrap}>
        {entry.image ? (
          <Image source={{ uri: entry.image }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Text style={styles.posterPlaceholderText}>?</Text>
          </View>
        )}
        {entry.score && entry.score !== '0' ? (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>★ {entry.score}</Text>
          </View>
        ) : null}
        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {entry.displayTitle || entry.title}
      </Text>
      {tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag.label} style={[styles.tag, { borderColor: tag.color }]}>
              <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {entry.comingSoonLanguages.length > 0 ? (
        <Text style={styles.comingText} numberOfLines={1}>
          Soon: {entry.comingSoonLanguages.join(', ')}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function Section({
  title,
  subtitle,
  items,
  resolving,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  items: DubEntry[];
  resolving: number | null;
  onOpen: (entry: DubEntry) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{items.length}</Text>
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
        {items.map((entry) => (
          <DubCard
            key={`${title}-${entry.mal_id}`}
            entry={entry}
            busy={resolving === entry.mal_id}
            onPress={() => onOpen(entry)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function DubbedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const primaryAccent = isDiwali ? '#f59e0b' : colors.primary;

  const [language, setLanguage] = useState<DubScheduleLanguage>('hindi');
  const [response, setResponse] = useState<DubScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);

  const load = useCallback(
    async (lang: DubScheduleLanguage) => {
      try {
        setError(null);
        const data = await api.dubSchedule.get(lang);
        setResponse(data);
      } catch (e: any) {
        setError(e?.message || 'Could not load dubbed anime');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    getPreferredDubLanguage()
      .then((pref) => {
        if (!active) return;
        const initial: DubScheduleLanguage = pref || 'hindi';
        setLanguage(initial);
        load(initial);
      })
      .catch(() => {
        if (active) load('hindi');
      });
    return () => {
      active = false;
    };
  }, [load]);

  const selectLanguage = (lang: DubScheduleLanguage) => {
    if (lang === language) return;
    setLanguage(lang);
    setLoading(true);
    load(lang);
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(language);
  };

  // Dub entries are keyed by MAL id, so resolve the AniList id by title
  // before opening the detail screen. Falls back to a title search.
  const openEntry = async (entry: DubEntry) => {
    if (resolving !== null) return;
    const title = entry.displayTitle || entry.title;
    setResolving(entry.mal_id);
    try {
      const matches = await api.suggestions(title);
      const match = matches[0];
      if (match) {
        navigation.navigate('AnimeDetail', { id: match.id, title: match.title });
      } else {
        navigation.navigate('Browse', { search: title, title });
      }
    } catch {
      navigation.navigate('Browse', { search: title, title });
    } finally {
      setResolving(null);
    }
  };

  if (loading && !response) return <LoadingSpinner fullScreen />;

  if (error && !response) {
    return <ErrorView message={error} onRetry={() => load(language)} />;
  }

  const data = response?.data;
  const counts = response?.counts;
  const currentSeason = data?.currentSeason || [];
  const recent = data?.recent || [];
  const available = data?.available || [];
  const comingSoon = data?.comingSoon || [];
  const total = counts?.total || 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryAccent} />
      }
    >
      <FadeInView delay={0} style={styles.intro}>
        <Text style={styles.heading}>Anime Dubs</Text>
        <Text style={styles.subheading}>
          Track English, Hindi, Tamil & Telugu dubs from official sources.
        </Text>
      </FadeInView>

      <FadeInView delay={60}>
        <TouchableOpacity
          style={[
            styles.dailyScheduleBanner,
            { borderColor: `${primaryAccent}66`, backgroundColor: colors.surface },
          ]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('DailyDubSchedule')}
        >
          <Text style={{ fontSize: 24 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dailyScheduleTitle, { color: colors.text }]}>
              Daily Dub Release Timetable
            </Text>
            <Text style={[styles.dailyScheduleSub, { color: primaryAccent }]}>
              Exact airtimes for Hindi, Tamil & Telugu releases today →
            </Text>
          </View>
        </TouchableOpacity>
      </FadeInView>

      <FadeInView delay={110}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langRow}
        >
          {LANGUAGES.map((lang) => {
            const active = language === lang.key;
            const count = counts ? (counts as unknown as Record<string, number>)[lang.key] : undefined;
            return (
              <TouchableOpacity
                key={lang.key}
                style={[
                  styles.langChip,
                  active && { backgroundColor: lang.color, borderColor: lang.color },
                ]}
                onPress={() => selectLanguage(lang.key)}
              >
                <Text style={[styles.langText, active && styles.langTextActive]}>
                  {lang.label}
                  {count !== undefined ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </FadeInView>

      {total === 0 ? (
        <FadeInView delay={160} style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No dubbed anime found for this language yet</Text>
          <Text style={styles.emptyHint}>Try another language or pull to refresh.</Text>
        </FadeInView>
      ) : (
        <>
          <FadeInView delay={160}>
            <Section
              title="Airing This Season"
              subtitle="New episodes streaming with dubs"
              items={currentSeason.length > 0 ? currentSeason : recent}
              resolving={resolving}
              onOpen={openEntry}
            />
          </FadeInView>
          <FadeInView delay={200}>
            <Section
              title="Available Now"
              subtitle="Complete dubbed seasons you can binge"
              items={available}
              resolving={resolving}
              onOpen={openEntry}
            />
          </FadeInView>
          <FadeInView delay={240}>
            <Section
              title="Coming Soon"
              subtitle="Dubs announced for future release"
              items={comingSoon}
              resolving={resolving}
              onOpen={openEntry}
            />
          </FadeInView>
        </>
      )}

      <FadeInView delay={280}>
        <TouchableOpacity
          style={styles.settingsLink}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsLinkText}>Set your preferred dub language in Settings →</Text>
        </TouchableOpacity>
      </FadeInView>
    </ScrollView>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  intro: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
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
  langRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  langChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  langTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  rowContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    width: 120,
  },
  posterWrap: {
    width: 120,
    height: 170,
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
  },
  posterPlaceholderText: {
    color: colors.textDim,
    fontSize: fontSize.xl,
  },
  scoreBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(10,10,15,0.8)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  scoreText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
  },
  tag: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  comingText: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 3,
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
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  dailyScheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  dailyScheduleTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  dailyScheduleSub: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  settingsLink: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  settingsLinkText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
}));
