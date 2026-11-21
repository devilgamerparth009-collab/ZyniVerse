import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import type { LiveDubAiring, LiveDubScheduleResponse } from '../types';
import { colors, fontSize, spacing, borderRadius, themed } from '../theme';
import { openSafeWebUrl } from '../utils/safeLinks';
import SafeImage from './SafeImage';
import PressableScale from './PressableScale';
import FadeInView from './FadeInView';
import { SkeletonBlock } from './Skeletons';
import AdBanner from './AdBanner';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function istDateLabel(iso: string | null): string {
  if (!iso) return 'Time to be announced';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time to be announced';
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const hours = ist.getUTCHours() % 12 || 12;
  const suffix = ist.getUTCHours() < 12 ? 'AM' : 'PM';
  return `${pad(ist.getUTCDate())} ${MONTHS[ist.getUTCMonth()]} · ${hours}:${pad(ist.getUTCMinutes())} ${suffix} IST`;
}

function fetchedLabel(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())} IST`;
}

function countdown(releaseAt: string | null, now: number) {
  if (!releaseAt) return null;
  const target = new Date(releaseAt).getTime();
  if (!Number.isFinite(target)) return null;
  const remaining = Math.max(0, target - now);
  return {
    live: remaining === 0,
    parts: [
      { key: 'd', label: 'Days', value: Math.floor(remaining / 86_400_000) },
      { key: 'h', label: 'Hrs', value: Math.floor((remaining % 86_400_000) / 3_600_000) },
      { key: 'm', label: 'Min', value: Math.floor((remaining % 3_600_000) / 60_000) },
      { key: 's', label: 'Sec', value: Math.floor((remaining % 60_000) / 1000) },
    ],
  };
}

function CountdownPanel({ releaseAt, now, tint }: { releaseAt: string | null; now: number; tint: string }) {
  const state = countdown(releaseAt, now);
  if (!state) {
    return (
      <View style={styles.countdownEmpty}>
        <Text style={styles.countdownEmptyText}>TIME TBA</Text>
      </View>
    );
  }

  return (
    <View style={[styles.countdownPanel, { borderColor: `${tint}3d` }]}>
      <Text style={[styles.countdownHeading, { color: tint }]}>
        {state.live ? '● ONGOING RELEASE' : 'NEXT RELEASE IN'}
      </Text>
      {state.live ? (
        <Text style={styles.liveText}>Available now on the source site</Text>
      ) : (
        <View style={styles.countdownRow}>
          {state.parts.map((part) => (
            <View key={part.key} style={styles.countdownBox}>
              <Text style={styles.countdownValue}>{pad(part.value)}</Text>
              <Text style={styles.countdownLabel}>{part.label}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.releaseDate}>{istDateLabel(releaseAt)}</Text>
    </View>
  );
}

function LanguageChips({ languages }: { languages: string[] }) {
  if (!languages.length) return null;
  return (
    <View style={styles.langRow}>
      {languages.slice(0, 4).map((language) => (
        <View key={language} style={styles.langChip}>
          <Text style={styles.langText}>{language}</Text>
        </View>
      ))}
      {languages.length > 4 ? <Text style={styles.moreLangs}>+{languages.length - 4}</Text> : null}
    </View>
  );
}

function ListRow({
  item,
  index,
  now,
  tint,
  onOpenTitle,
}: {
  item: LiveDubAiring;
  index: number;
  now: number;
  tint: string;
  onOpenTitle: (title: string) => void;
}) {
  return (
    <FadeInView delay={Math.min(index, 10) * 35} offset={8}>
      <PressableScale
        scaleTo={0.99}
        onPress={() => onOpenTitle(item.title)}
        accessibilityLabel={`Open ${item.title}`}
        style={styles.listCard}
      >
        <View style={styles.listTop}>
          <SafeImage
            uri={item.posterUrl}
            fallbackLabel={item.title}
            style={styles.listPoster}
            accessibilityLabel={item.title}
          />
          <View style={styles.listBody}>
            <Text style={styles.listTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              {item.season ? <Text style={styles.metaPill}>{item.season}</Text> : null}
              {item.episodeInfo ? <Text style={styles.metaPill}>{item.episodeInfo}</Text> : null}
            </View>
            <Text style={styles.metaLine}>
              {item.dayLabel || 'Weekly'} {item.timeLabel ? `· ${item.timeLabel}` : ''} · IST
            </Text>
            <LanguageChips languages={item.languages} />
          </View>
        </View>
        <CountdownPanel releaseAt={item.releaseAt} now={now} tint={tint} />
      </PressableScale>
    </FadeInView>
  );
}

function GridTile({
  item,
  index,
  width,
  now,
  tint,
  onOpenTitle,
}: {
  item: LiveDubAiring;
  index: number;
  width: number;
  now: number;
  tint: string;
  onOpenTitle: (title: string) => void;
}) {
  const state = countdown(item.releaseAt, now);
  return (
    <FadeInView delay={Math.min(index, 10) * 35} offset={8}>
      <PressableScale
        scaleTo={0.96}
        onPress={() => onOpenTitle(item.title)}
        accessibilityLabel={`Open ${item.title}`}
        style={[styles.gridCard, { width }]}
      >
        <SafeImage
          uri={item.posterUrl}
          fallbackLabel={item.title}
          style={styles.gridPoster}
          accessibilityLabel={item.title}
        />
        <View style={styles.gridBody}>
          <Text style={styles.gridTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.gridMeta} numberOfLines={1}>
            {[item.season, item.episodeInfo].filter(Boolean).join(' · ') || item.dayLabel || 'Weekly'}
          </Text>
          <Text style={[styles.gridCountdown, { color: state?.live ? '#22c55e' : tint }]} numberOfLines={1}>
            {state
              ? state.live
                ? '● ONGOING'
                : `${pad(state.parts[1].value)}h ${pad(state.parts[2].value)}m ${pad(state.parts[3].value)}s`
              : 'TIME TBA'}
          </Text>
        </View>
      </PressableScale>
    </FadeInView>
  );
}

function SectionHeading({ emoji, title, count, tint }: { emoji: string; title: string; count: number; tint: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={[styles.sectionTitle, { color: tint }]}>{title}</Text>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function LiveSkeleton({ header }: { header?: React.ReactNode }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {header}
      <View style={styles.skeletonWrap}>
        <SkeletonBlock height={18} width="45%" radius={borderRadius.sm} />
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.skeletonRow}>
            <SkeletonBlock height={84} width={58} radius={borderRadius.md} />
            <View style={{ flex: 1 }}>
              <SkeletonBlock height={14} width="85%" />
              <SkeletonBlock height={11} width="55%" style={styles.skeletonGap} />
              <SkeletonBlock height={11} width="70%" style={styles.skeletonGap} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Mirror of animedubhindi.link/schedule.php for the APK:
 * Ongoing + Upcoming, IST timing, 1-second countdown, list/grid views and a
 * 60-second refresh while this tab is visible.
 */
export default function LiveDubSchedule({
  tint,
  header,
  onOpenTitle,
}: {
  tint: string;
  header?: React.ReactNode;
  onOpenTitle: (title: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<LiveDubScheduleResponse | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      const response = await api.dub.liveSchedule(force);
      if (response?.success && (response.ongoing.length || response.upcoming.length)) {
        setData(response);
      } else {
        setError('Live schedule is temporarily unavailable.');
      }
    } catch {
      setError('Live schedule is temporarily unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => load(true), 60_000);
      return () => clearInterval(timer);
    }, [load])
  );

  const gridWidth = useMemo(() => Math.floor((width - spacing.md * 2 - spacing.sm) / 2), [width]);
  const total = data ? data.ongoing.length + data.upcoming.length : 0;

  const content = (
    <>
      <View style={styles.introCard}>
        <View style={styles.introTop}>
          <View style={[styles.istBadge, { borderColor: `${tint}66` }]}>
            <Text style={[styles.istText, { color: tint }]}>IST · INDIAN STANDARD TIME</Text>
          </View>
          <TouchableOpacity
            onPress={() => openSafeWebUrl(data?.sourceUrl || 'https://www.animedubhindi.link/schedule.php')}
            accessibilityLabel="Open source schedule"
          >
            <Text style={[styles.sourceLink, { color: tint }]}>Source ↗</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.introText}>
          A live mirror of the Anime Dub Hindi schedule. Countdowns update every second and the
          list refreshes automatically every minute.
        </Text>
        <View style={styles.introMeta}>
          <Text style={styles.introMetaText}>{total} titles tracked</Text>
          <Text style={styles.introDot}>·</Text>
          <Text style={styles.introMetaText}>
            {data?.fetchedAt ? `Updated ${fetchedLabel(data.fetchedAt)}` : 'Auto-update on'}
          </Text>
        </View>
        <View style={styles.viewToggle}>
          {(['list', 'grid'] as const).map((option) => {
            const active = view === option;
            return (
              <PressableScale
                key={option}
                scaleTo={0.94}
                onPress={() => setView(option)}
                style={[styles.viewChip, active && [styles.viewChipActive, { borderColor: tint }]]}
              >
                <Text style={[styles.viewChipText, active && { color: tint }]}>
                  {option === 'list' ? '☰ List' : '▦ Grid'}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {error ? (
          <TouchableOpacity style={styles.errorBox} onPress={() => load(true)}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <AdBanner placement="dub-schedule" size="banner" />

      {!data ? null : (
        <>
          <SectionHeading emoji="🔥" title="Ongoing Releases" count={data.ongoing.length} tint={tint} />
          {data.ongoing.length ? (
            view === 'list' ? (
              data.ongoing.map((item, index) => (
                <ListRow
                  key={item.id}
                  item={item}
                  index={index}
                  now={now}
                  tint={tint}
                  onOpenTitle={onOpenTitle}
                />
              ))
            ) : (
              <View style={styles.gridWrap}>
                {data.ongoing.map((item, index) => (
                  <GridTile
                    key={item.id}
                    item={item}
                    index={index}
                    width={gridWidth}
                    now={now}
                    tint={tint}
                    onOpenTitle={onOpenTitle}
                  />
                ))}
              </View>
            )
          ) : (
            <Text style={styles.emptySection}>No ongoing releases right now.</Text>
          )}

          <SectionHeading emoji="⏳" title="Upcoming Releases" count={data.upcoming.length} tint={tint} />
          {data.upcoming.length ? (
            view === 'list' ? (
              data.upcoming.map((item, index) => (
                <ListRow
                  key={item.id}
                  item={item}
                  index={index}
                  now={now}
                  tint={tint}
                  onOpenTitle={onOpenTitle}
                />
              ))
            ) : (
              <View style={styles.gridWrap}>
                {data.upcoming.map((item, index) => (
                  <GridTile
                    key={item.id}
                    item={item}
                    index={index}
                    width={gridWidth}
                    now={now}
                    tint={tint}
                    onOpenTitle={onOpenTitle}
                  />
                ))}
              </View>
            )
          ) : (
            <Text style={styles.emptySection}>No upcoming releases announced.</Text>
          )}

          <TouchableOpacity
            style={styles.sourceFooter}
            onPress={() => openSafeWebUrl(data.sourceUrl)}
          >
            <Text style={[styles.sourceFooterText, { color: tint }]}>View full schedule on source ↗</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  if (loading) return <LiveSkeleton header={header} />;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          tintColor={tint}
        />
      }
    >
      {header}
      {content}
    </ScrollView>
  );
}

const styles = themed(() => ({
  introCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  introTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  istBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  istText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sourceLink: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  introText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  introMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  introMetaText: {
    color: colors.textDim,
    fontSize: 10.5,
    fontWeight: '700',
  },
  introDot: {
    color: colors.textDim,
    fontSize: 10.5,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm + 2,
  },
  viewChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  viewChipActive: {
    backgroundColor: `${colors.secondary}18`,
  },
  viewChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  errorBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: `${colors.error}66`,
    backgroundColor: `${colors.error}16`,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionEmoji: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
  listCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  listTop: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  listPoster: {
    width: 62,
    height: 90,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  listBody: {
    flex: 1,
  },
  listTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '900',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  metaPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  metaLine: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 6,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 7,
  },
  langChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  langText: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '800',
  },
  moreLangs: {
    color: colors.textDim,
    fontSize: 9.5,
    alignSelf: 'center',
  },
  countdownPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm + 2,
  },
  countdownHeading: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  countdownBox: {
    width: 54,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  countdownValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  countdownLabel: {
    color: colors.textDim,
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  countdownEmpty: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  countdownEmptyText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  liveText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  releaseDate: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gridPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: colors.background,
  },
  gridBody: {
    padding: spacing.sm,
  },
  gridTitle: {
    color: colors.text,
    fontSize: 12.5,
    fontWeight: '900',
    lineHeight: 17,
  },
  gridMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 4,
  },
  gridCountdown: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
  },
  emptySection: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  sourceFooter: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  sourceFooterText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  skeletonWrap: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skeletonGap: {
    marginTop: 8,
  },
}));
