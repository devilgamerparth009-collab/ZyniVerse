import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { LeaderboardEntry } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';

function PodiumCard({
  entry,
  place,
  color,
  height,
  tint,
  colors,
  isMe,
}: {
  entry?: LeaderboardEntry;
  place: number;
  color: string;
  height: number;
  tint: string;
  colors: any;
  isMe: boolean;
}) {
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(grow, { toValue: 1, useNativeDriver: false, friction: 7, tension: 50 }).start();
  }, [grow]);

  const blockHeight = grow.interpolate({ inputRange: [0, 1], outputRange: [0, height] });

  if (!entry) {
    return <View style={styles.podiumSlot} />;
  }

  return (
    <View style={styles.podiumSlot}>
      <Animated.View style={{ transform: [{ scale: grow }] }}>
        {entry.avatar ? (
          <Image
            source={{ uri: entry.avatar }}
            style={[styles.podiumAvatar, { borderColor: color }]}
          />
        ) : (
          <View
            style={[
              styles.podiumAvatar,
              { borderColor: color, backgroundColor: `${color}33`, alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <Text style={{ color, fontWeight: '900', fontSize: 22 }}>
              {entry.username?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
        {entry.username}
      </Text>
      <Text style={[styles.podiumPoints, { color }]}>{entry.points.toLocaleString()}</Text>
      <Animated.View style={[styles.podiumBlock, { backgroundColor: `${color}2a`, borderColor: color, height: blockHeight }]}>
        <Text style={[styles.podiumPlace, { color }]}>{place === 1 ? '👑' : `#${place}`}</Text>
      </Animated.View>
      {isMe && <Text style={[styles.youTag, { color: tint }]}>YOU</Text>}
    </View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const tint = isLaunch ? '#22d3ee' : colors.primary;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, user] = await Promise.all([
        api.fun.leaderboard(100, 0),
        getCurrentUser().catch(() => null),
      ]);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setMyId(user?.id || null);
    } catch {
      setError('Could not load the leaderboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const myRank = myId ? entries.findIndex((e) => e.userId === myId) + 1 : 0;
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Leaderboard" emoji="🏆" subtitle="The most active fans on ZyniVerse" accent={tint} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tint} size="large" />
        </View>
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />
          }
        >
          {/* Podium */}
          <View style={[styles.podium, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.podiumKicker, { color: tint }]}>HALL OF FAME</Text>
            <View style={styles.podiumRow}>
              <PodiumCard
                entry={top3[1]}
                place={2}
                color="#c0c0c0"
                height={78}
                tint={tint}
                colors={colors}
                isMe={!!top3[1] && top3[1].userId === myId}
              />
              <PodiumCard
                entry={top3[0]}
                place={1}
                color="#fbbf24"
                height={112}
                tint={tint}
                colors={colors}
                isMe={!!top3[0] && top3[0].userId === myId}
              />
              <PodiumCard
                entry={top3[2]}
                place={3}
                color="#cd7f32"
                height={62}
                tint={tint}
                colors={colors}
                isMe={!!top3[2] && top3[2].userId === myId}
              />
            </View>
            <Text style={[styles.totalText, { color: colors.textDim }]}>
              {total} ranked fans
              {myRank > 0 ? ` · you're #${myRank}` : ''}
            </Text>
          </View>

          {/* Rest of the list */}
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {rest.length === 0 && entries.length <= 3 && (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                The board is still warming up. Earn points by watching, reviewing and joining events.
              </Text>
            )}
            {rest.map((entry, i) => {
              const isMe = entry.userId === myId;
              return (
                <FadeInView key={entry.userId} delay={Math.min(i * 35, 500)} offset={8}>
                  <View
                    style={[
                      styles.row,
                      { borderTopColor: colors.border },
                      isMe && { backgroundColor: `${tint}12` },
                    ]}
                  >
                    <Text style={[styles.rank, { color: colors.textMuted }]}>{i + 4}</Text>
                    {entry.avatar ? (
                      <Image source={{ uri: entry.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${tint}22` }]}>
                        <Text style={{ color: tint, fontWeight: '800' }}>
                          {entry.username?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                        {entry.username}
                        {isMe ? '  (you)' : ''}
                      </Text>
                      <Text style={[styles.meta, { color: colors.textMuted }]}>
                        Level {entry.level} · {entry.achievements} achievements
                      </Text>
                    </View>
                    <Text style={[styles.points, { color: isMe ? tint : colors.text }]}>
                      {entry.points.toLocaleString()}
                    </Text>
                  </View>
                </FadeInView>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podium: {
    margin: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  podiumKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
  },
  podiumAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    marginBottom: 6,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 92,
    textAlign: 'center',
  },
  podiumPoints: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },
  podiumBlock: {
    width: '82%',
    borderWidth: 1,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  podiumPlace: {
    fontSize: 16,
    fontWeight: '900',
  },
  youTag: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
  },
  totalText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  list: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  emptyText: {
    fontSize: fontSize.sm,
    padding: spacing.md,
    lineHeight: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rank: {
    width: 28,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  meta: {
    fontSize: 10,
    marginTop: 1,
  },
  points: {
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
});
