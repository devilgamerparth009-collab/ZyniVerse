import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { CharacterTournament } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import AdBanner from '../components/AdBanner';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';

const STATUS_META: Record<string, { label: string; color: string; badge: string }> = {
  active: { label: 'LIVE BATTLE', color: '#ff007f', badge: '🔥' },
  qualifying: { label: 'QUALIFYING', color: '#00ffe0', badge: '⚡' },
  upcoming: { label: 'UPCOMING', color: '#f59e0b', badge: '⏳' },
  completed: { label: 'HALL OF FAME', color: '#22c55e', badge: '👑' },
  cancelled: { label: 'CLOSED', color: '#ef4444', badge: '⛔' },
};

/** Related features fans can jump to straight from the arena. */
const EXPLORE_ITEMS: {
  key: string;
  icon: string;
  label: string;
  sub: string;
  tint: string;
  route: string;
  tab?: boolean;
}[] = [
  { key: 'leaderboard', icon: '🏆', label: 'Leaderboard', sub: 'See the top fans this season', tint: '#eab308', route: 'Leaderboard' },
  { key: 'polls', icon: '🗳️', label: 'Fan Polls', sub: 'Vote on community picks', tint: '#22c55e', route: 'Polls' },
  { key: 'fun', icon: '🎮', label: 'Fun Zone', sub: 'Games, quizzes and more', tint: '#a855f7', route: 'FunZone', tab: true },
];

function countdownLabel(endsAt?: string | null): string | null {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Voting closed';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `⏳ ${days}d ${hours}h left`;
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `⏳ ${hours}h ${minutes}m left`;
}

type TabKey = 'live' | 'all' | 'history';

export default function TournamentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();

  const [tournaments, setTournaments] = useState<CharacterTournament[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setClockTick] = useState(0);

  const fetchTournaments = useCallback(async () => {
    try {
      setError(null);
      const data = await api.tournaments.list();
      setTournaments(data);
    } catch {
      setError('Could not load anime tournaments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTournaments();
  };

  // Refetch every time the Arena tab becomes visible: a tournament created on
  // the website (or on another device) must show up without reinstalling.
  useFocusEffect(
    useCallback(() => {
      fetchTournaments();
      const timer = setInterval(() => setClockTick((tick) => tick + 1), 60_000);
      return () => clearInterval(timer);
    }, [fetchTournaments])
  );

  const primaryColor = isLaunch ? '#22d3ee' : colors.primary;

  const liveList = tournaments.filter(
    (t) => t.status === 'active' || t.status === 'qualifying' || t.status === 'upcoming'
  );
  const historyList = tournaments.filter(
    (t) => t.status === 'completed' || t.status === 'cancelled'
  );
  const featured = useMemo(() => {
    const priority: Record<string, number> = { active: 0, qualifying: 1, upcoming: 2 };
    return [...liveList].sort(
      (a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9)
    )[0] || null;
  }, [liveList]);

  const displayedList =
    activeTab === 'live' ? liveList : activeTab === 'history' ? historyList : tournaments;

  const renderTournament = ({ item, index }: { item: CharacterTournament; index: number }) => {
    const meta = STATUS_META[item.status] || {
      label: item.status.toUpperCase(),
      color: colors.textDim,
      badge: '⚔️',
    };
    const countdown = countdownLabel(
      item.mode === 'qualifying' ? item.qualifyingEndsAt : item.roundEndsAt
    );

    return (
      <FadeInView delay={Math.min(index * 40, 320)} offset={12} duration={340}>
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('TournamentDetail', {
              id: item.id,
              title: item.title,
            })
          }
        >
          {/* Header Status Tag */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusTag, { backgroundColor: `${meta.color}20`, borderColor: meta.color }]}>
              <Text style={[styles.statusText, { color: meta.color }]}>
                {meta.badge} {meta.label}
              </Text>
            </View>

            {countdown && (
              <Text style={[styles.countdownText, { color: colors.textMuted }]}>
                {countdown}
              </Text>
            )}
          </View>

          {/* Tournament Title */}
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          {item.description && (
            <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Arena Stats Footer */}
          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            <View style={styles.participantRow}>
              <Text style={[styles.statValue, { color: primaryColor }]}>
                {item.characterCount || item.totalSlots || 32} Contenders
              </Text>
              <Text style={[styles.statDot, { color: colors.textDim }]}>•</Text>
              <Text style={[styles.statValue, { color: colors.textMuted }]}>
                {item.currentRound ? `Round ${item.currentRound}` : 'Elimination Stage'}
              </Text>
            </View>

            <View style={[styles.voteActionBtn, { backgroundColor: primaryColor }]}>
              <Text style={styles.voteActionText}>Enter Arena ➔</Text>
            </View>
          </View>
        </TouchableOpacity>

      </FadeInView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Arena Banner Header */}
      <FadeInView delay={0} style={[styles.heroHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <View style={styles.liveTagRow}>
              <Text style={{ fontSize: 13 }}>⚔️</Text>
              <Text style={[styles.liveTagText, { color: primaryColor }]}>
                ANIME CHARACTER BATTLES
              </Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Tournament Arena</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Create tournament"
            activeOpacity={0.85}
            onPress={() => navigation.navigate('TournamentCreate')}
            style={[styles.createBtn, { backgroundColor: primaryColor }]}
          >
            <Text style={styles.createBtnText}>＋ Create</Text>
          </TouchableOpacity>
        </View>

        {/* Featured battle: the arena's main event, not just another row. */}
        {featured ? (
          <FadeInView delay={30} offset={10}>
            <PressableScale
              scaleTo={0.99}
              accessibilityLabel={`Enter ${featured.title}`}
              onPress={() =>
                navigation.navigate('TournamentDetail', {
                  id: featured.id,
                  title: featured.title,
                })
              }
              style={[
                styles.featuredCard,
                {
                  backgroundColor: colors.background,
                  borderColor: `${primaryColor}66`,
                },
              ]}
            >
              <View
                pointerEvents="none"
                style={[styles.featuredGlow, { backgroundColor: `${primaryColor}22` }]}
              />
              <View style={styles.featuredTop}>
                <View
                  style={[
                    styles.featuredBadge,
                    { backgroundColor: `${STATUS_META[featured.status]?.color || primaryColor}22` },
                  ]}
                >
                  <Text
                    style={[
                      styles.featuredBadgeText,
                      { color: STATUS_META[featured.status]?.color || primaryColor },
                    ]}
                  >
                    ⚡ FEATURED BATTLE
                  </Text>
                </View>
                <Text style={[styles.featuredCountdown, { color: colors.textMuted }]}>
                  {countdownLabel(
                    featured.mode === 'qualifying'
                      ? featured.qualifyingEndsAt
                      : featured.roundEndsAt
                  ) || 'Voting open'}
                </Text>
              </View>
              <Text style={[styles.featuredTitle, { color: colors.text }]} numberOfLines={2}>
                {featured.title}
              </Text>
              <View style={styles.featuredFooter}>
                <Text style={[styles.featuredMeta, { color: colors.textMuted }]}>
                  {featured.characterCount || featured.totalSlots || 32} contenders ·{' '}
                  {featured.currentRound ? `Round ${featured.currentRound}` : 'Elimination stage'}
                </Text>
                <Text style={[styles.featuredCta, { color: primaryColor }]}>Enter arena ›</Text>
              </View>
            </PressableScale>
          </FadeInView>
        ) : null}

        {/* Tab Filters */}
        <View style={styles.tabBar}>
          {[
            { key: 'live' as TabKey, label: '🔥 Live Battles', count: liveList.length },
            { key: 'history' as TabKey, label: '👑 Champions', count: historyList.length },
            { key: 'all' as TabKey, label: '🌐 All Events', count: tournaments.length },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabBtn,
                  active && {
                    backgroundColor: primaryColor,
                  },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: active ? '#ffffff' : colors.textMuted },
                  ]}
                >
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Explore this feature */}
        <View style={styles.exploreSection}>
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
                onPress={() =>
                  item.tab
                    ? navigation.navigate('MainTabs', { screen: item.route })
                    : navigation.navigate(item.route)
                }
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
                <Text style={[styles.exploreArrow, { color: primaryColor }]}>›</Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      </FadeInView>

      {/* Tournaments List */}
      {loading && tournaments.length === 0 ? (
        <View style={{ paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : error && tournaments.length === 0 ? (
        <ErrorView message={error} onRetry={fetchTournaments} />
      ) : (
        <FlatList
          data={displayedList}
          keyExtractor={(item) => item.id}
          renderItem={renderTournament}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingTop: 6 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
          ListHeaderComponent={<AdBanner placement="tournaments-top" size="banner" />}
          ListEmptyComponent={
            <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
              <Text style={{ fontSize: 44, marginBottom: 8 }}>⚔️</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No events in this category
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Check back soon or view active tournaments.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  createBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  featuredCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  featuredGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -100,
    right: -70,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  featuredBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  featuredCountdown: {
    fontSize: 10,
    fontWeight: '700',
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  featuredMeta: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  featuredCta: {
    fontSize: 12,
    fontWeight: '900',
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  exploreSection: {
    marginTop: 12,
  },
  exploreTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  exploreRow: {
    gap: 10,
  },
  exploreCard: {
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
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
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  statDot: {
    fontSize: 12,
  },
  voteActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  voteActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
});
