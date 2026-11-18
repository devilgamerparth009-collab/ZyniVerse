import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { getEpisodeTypeColor } from '../utils/helpers';
import FillerProgress from '../components/FillerProgress';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import SafeImage from '../components/SafeImage';
import { SkeletonBlock } from '../components/Skeletons';
import { api } from '../services/api';
import type { FillerData } from '../types';

type GuideState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no-data' }
  | { kind: 'no-fillers'; data: FillerData }
  | { kind: 'ready'; data: FillerData };

export default function FillerGuideScreen() {
  const route = useRoute<any>();
  const { id, title: animeTitle, image } = route.params || {};
  const { colors, isDiwali } = useTheme();
  const primaryAccent = isDiwali ? '#f59e0b' : colors.primary;

  const fillerId = Number(id);
  const hasTitle = typeof animeTitle === 'string' && animeTitle.trim().length > 0;
  const displayTitle = hasTitle ? (animeTitle as string).trim() : 'This title';

  const [state, setState] = useState<GuideState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      if (!Number.isFinite(fillerId) || fillerId <= 0) {
        setState({
          kind: 'error',
          message: 'This title could not be looked up. Please open it again from its detail page.',
        });
        return;
      }
      const result = await api.filler.get(fillerId, hasTitle ? displayTitle : undefined);
      if (!result) {
        setState({ kind: 'no-data' });
        return;
      }
      const hasFillerEpisodes = result.episodes.some((ep) => ep.type === 'filler');
      if (!hasFillerEpisodes || result.totalFillers === 0) {
        setState({ kind: 'no-fillers', data: result });
        return;
      }
      setState({ kind: 'ready', data: result });
    } catch (e: any) {
      setState({
        kind: 'error',
        message: e?.message || 'Network error. Please try again when you are back online.',
      });
    } finally {
      setRefreshing(false);
    }
  }, [displayTitle, fillerId, hasTitle]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const renderGuide = (data: FillerData, zeroFillers: boolean) => {
    const canonCount = data.episodes.filter((ep) => ep.type === 'canon').length;
    const mixedCount = data.episodes.filter((ep) => ep.type === 'mixed').length;
    const fillerCount = data.episodes.filter((ep) => ep.type === 'filler').length;

    return (
      <>
        {zeroFillers ? (
          <FadeInView delay={40}>
            <View style={[styles.noticeCard, { borderColor: `${colors.success}66` }]}>
              <Text style={styles.noticeIcon}>✅</Text>
              <Text style={[styles.noticeTitle, { color: colors.text }]}>
                No filler episodes found
              </Text>
              <Text style={[styles.noticeText, { color: colors.textMuted }]}>
                Every listed episode for this title is canon or mixed. You can watch straight through.
              </Text>
            </View>
          </FadeInView>
        ) : null}

        <FadeInView delay={80}>
          <FillerProgress
            totalEpisodes={data.totalEpisodes}
            totalFillers={data.totalFillers}
            fillerPercentage={data.fillerPercentage}
          />
        </FadeInView>

        <FadeInView delay={120} style={styles.summaryRow}>
          <View style={[styles.summaryBox, { borderColor: colors.success }]}>
            <Text style={[styles.summaryCount, { color: colors.success }]}>{canonCount}</Text>
            <Text style={styles.summaryLabel}>Canon</Text>
          </View>
          <View style={[styles.summaryBox, { borderColor: colors.warning }]}>
            <Text style={[styles.summaryCount, { color: colors.warning }]}>{mixedCount}</Text>
            <Text style={styles.summaryLabel}>Mixed</Text>
          </View>
          <View style={[styles.summaryBox, { borderColor: colors.error }]}>
            <Text style={[styles.summaryCount, { color: colors.error }]}>{fillerCount}</Text>
            <Text style={styles.summaryLabel}>Filler</Text>
          </View>
        </FadeInView>

        <FadeInView delay={160} style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Canon</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.legendText}>Mixed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
            <Text style={styles.legendText}>Filler</Text>
          </View>
        </FadeInView>

        <View style={styles.episodeList}>
          <FadeInView delay={190}>
            <Text style={styles.sectionTitle}>Episodes</Text>
          </FadeInView>
          {data.episodes.map((ep, index) => (
            <FadeInView
              key={ep.episode}
              delay={Math.min(210 + (index % 12) * 20, 520)}
              duration={300}
              offset={10}
            >
              <View style={[styles.episodeItem, { borderLeftColor: getEpisodeTypeColor(ep.type) }]}>
                <View style={styles.episodeInfo}>
                  <Text style={styles.episodeNumber}>Ep. {ep.episode}</Text>
                  {!!ep.title ? <Text style={styles.episodeTitle}>{ep.title}</Text> : null}
                </View>
                <View
                  style={[
                    styles.episodeTypeBadge,
                    { backgroundColor: `${getEpisodeTypeColor(ep.type)}33` },
                  ]}
                >
                  <Text style={[styles.episodeTypeText, { color: getEpisodeTypeColor(ep.type) }]}>
                    {ep.type}
                  </Text>
                </View>
              </View>
            </FadeInView>
          ))}
        </View>
      </>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryAccent} />
      }
    >
      <FadeInView duration={360}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SafeImage
            uri={image}
            fallbackLabel={displayTitle}
            style={styles.heroPoster}
            accessibilityLabel={displayTitle}
          />
          <View style={styles.heroText}>
            <Text style={[styles.eyebrow, { color: primaryAccent }]}>FILLER GUIDE</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
              {displayTitle}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Skip the filler. Keep the story.
            </Text>
          </View>
        </View>
      </FadeInView>

      {state.kind === 'loading' ? (
        <View style={styles.skeletonWrap}>
          <SkeletonBlock height={70} radius={borderRadius.lg} />
          <SkeletonBlock height={54} style={styles.skeletonGap} radius={borderRadius.md} />
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} height={38} style={styles.skeletonGap} radius={borderRadius.md} />
          ))}
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Could not load the guide</Text>
          <Text style={[styles.stateText, { color: colors.textMuted }]}>{state.message}</Text>
          <PressableScale onPress={fetchData} style={[styles.retryBtn, { backgroundColor: primaryAccent }]}>
            <Text style={[styles.retryText, { color: '#0a0a0f' }]}>Try again</Text>
          </PressableScale>
        </View>
      ) : state.kind === 'no-data' ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateIcon}>📭</Text>
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            No guide available for this title
          </Text>
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
            We do not have a filler list for “{displayTitle}” yet. Check back after the next update or
            try another title.
          </Text>
          <PressableScale onPress={fetchData} style={[styles.retryBtn, { backgroundColor: primaryAccent }]}>
            <Text style={[styles.retryText, { color: '#0a0a0f' }]}>Check again</Text>
          </PressableScale>
        </View>
      ) : (
        renderGuide(state.data, state.kind === 'no-fillers')
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 4,
    marginTop: spacing.md,
  },
  heroPoster: {
    width: 66,
    height: 92,
    borderRadius: borderRadius.md,
  },
  heroText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 3,
  },
  heroSub: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  skeletonWrap: {
    marginTop: spacing.md,
  },
  skeletonGap: {
    marginTop: spacing.sm,
  },
  stateCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  stateIcon: {
    fontSize: 34,
  },
  stateTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  stateText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.xs + 2,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  retryText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  noticeIcon: {
    fontSize: 26,
  },
  noticeTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  noticeText: {
    fontSize: fontSize.sm,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  episodeList: {
    marginBottom: spacing.lg,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
  },
  episodeInfo: {
    flex: 1,
  },
  episodeNumber: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  episodeTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  episodeTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.sm,
  },
  episodeTypeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
}));
