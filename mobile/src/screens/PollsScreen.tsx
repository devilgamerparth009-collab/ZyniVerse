import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { PollItem } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';
import { timeAgo } from '../utils/helpers';

function Bar({ pct, color, track }: { pct: number; color: string; track: string }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [pct, width]);

  return (
    <View style={[styles.barTrack, { backgroundColor: track }]}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

export default function PollsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();
  const tint = isLaunch ? '#22d3ee' : colors.primary;

  const [polls, setPolls] = useState<PollItem[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, user] = await Promise.all([
        api.fun.polls(1, 30, false),
        getCurrentUser().catch(() => null),
      ]);
      setPolls(data.polls || []);
      setLoggedIn(!!user);
    } catch {
      setError('Could not load polls right now.');
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

  const vote = async (poll: PollItem, optionId: string) => {
    if (myVotes[poll.id]) return;
    if (loggedIn === false) {
      Alert.alert('Sign in to vote', 'Create a free account to vote in community polls.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setVoting(poll.id);
    try {
      const updated = await api.fun.votePoll(poll.id, optionId);
      setMyVotes((m) => ({ ...m, [poll.id]: optionId }));
      setPolls((list) =>
        list.map((p) =>
          p.id === poll.id
            ? {
                ...p,
                ...updated,
                options: updated?.options?.length ? updated.options : p.options,
              }
            : p
        )
      );
    } catch (e: any) {
      Alert.alert('Vote failed', e?.message || 'Please try again in a moment.');
    } finally {
      setVoting(null);
    }
  };

  const totalVotes = (poll: PollItem) =>
    poll.options.reduce((sum, o) => sum + (o._count?.votes || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Community Polls"
        emoji="🗳️"
        subtitle="Vote and see what the fandom thinks"
        accent={tint}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tint} size="large" />
        </View>
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} />
          }
        >
          {polls.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🗳️</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No live polls yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Check back soon — the community posts new polls every week.
              </Text>
            </View>
          )}

          {polls.map((poll, pi) => {
            const votedOption = myVotes[poll.id];
            const total = totalVotes(poll);
            return (
              <FadeInView key={poll.id} delay={pi * 70}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.cardHead}>
                    <View style={[styles.liveTag, { backgroundColor: `${tint}1f` }]}>
                      <Text style={[styles.liveTagText, { color: tint }]}>● POLL</Text>
                    </View>
                    <Text style={[styles.meta, { color: colors.textDim }]}>
                      {poll.createdBy?.username ? `by ${poll.createdBy.username} · ` : ''}
                      {timeAgo(poll.createdAt)}
                    </Text>
                  </View>

                  <Text style={[styles.title, { color: colors.text }]}>{poll.title}</Text>
                  {!!poll.description && (
                    <Text style={[styles.desc, { color: colors.textMuted }]}>{poll.description}</Text>
                  )}

                  <View style={{ marginTop: spacing.sm }}>
                    {poll.options.map((opt) => {
                      const votes = opt._count?.votes || 0;
                      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                      const showResults = !!votedOption;
                      const isMine = votedOption === opt.id;

                      if (!showResults) {
                        return (
                          <PressableScale
                            key={opt.id}
                            onPress={() => vote(poll, opt.id)}
                            style={[
                              styles.optionBtn,
                              { borderColor: colors.border, backgroundColor: colors.background },
                            ]}
                          >
                            <Text style={[styles.optionText, { color: colors.text }]}>{opt.label}</Text>
                            {voting === poll.id ? (
                              <ActivityIndicator size="small" color={tint} />
                            ) : (
                              <Text style={[styles.voteArrow, { color: tint }]}>Vote →</Text>
                            )}
                          </PressableScale>
                        );
                      }

                      return (
                        <View
                          key={opt.id}
                          style={[
                            styles.resultRow,
                            { borderColor: isMine ? tint : colors.border },
                          ]}
                        >
                          <View style={styles.resultTop}>
                            <Text
                              style={[styles.resultLabel, { color: isMine ? tint : colors.text }]}
                              numberOfLines={2}
                            >
                              {isMine ? '✓ ' : ''}
                              {opt.label}
                            </Text>
                            <Text style={[styles.pct, { color: isMine ? tint : colors.textMuted }]}>
                              {pct}%
                            </Text>
                          </View>
                          <Bar pct={pct} color={isMine ? tint : colors.textDim} track={colors.border} />
                          <Text style={[styles.voteCount, { color: colors.textDim }]}>
                            {votes} vote{votes === 1 ? '' : 's'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.cardFoot}>
                    <Text style={[styles.totalVotes, { color: colors.textDim }]}>
                      {total} total vote{total === 1 ? '' : 's'}
                    </Text>
                    {!votedOption && loggedIn === false && (
                      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={[styles.signInHint, { color: tint }]}>Sign in to vote</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </FadeInView>
            );
          })}
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
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  liveTag: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  meta: {
    fontSize: 10,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '800',
    lineHeight: 22,
  },
  desc: {
    fontSize: fontSize.xs,
    marginTop: 4,
    lineHeight: 18,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    marginBottom: 8,
  },
  optionText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginRight: 8,
  },
  voteArrow: {
    fontSize: 11,
    fontWeight: '800',
  },
  resultRow: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: 8,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginRight: 8,
  },
  pct: {
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  voteCount: {
    fontSize: 10,
    marginTop: 4,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  totalVotes: {
    fontSize: 10,
  },
  signInHint: {
    fontSize: 11,
    fontWeight: '800',
  },
});
