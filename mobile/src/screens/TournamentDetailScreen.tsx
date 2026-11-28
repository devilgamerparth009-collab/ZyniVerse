import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { clearScreenCache, getScreenCache, setScreenCache } from '../utils/screenCache';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { CharacterTournamentDetail, TournamentParticipant, TournamentMatch } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';
import SafeImage from '../components/SafeImage';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function Countdown({ endsAt }: { endsAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let text = '🏆 ';
  if (endsAt) {
    const diff = new Date(endsAt).getTime() - now;
    if (diff <= 0) {
      text = 'Qualifying has closed';
    } else {
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      text = d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
    }
  }
  return <Text style={styles.countdownValue}> {text}</Text>;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  qualifying: { label: 'QUALIFYING', color: '#00ffe0' },
  active: { label: 'LIVE', color: '#ff00e6' },
  upcoming: { label: 'UPCOMING', color: '#f59e0b' },
  completed: { label: 'COMPLETED', color: '#22c55e' },
  cancelled: { label: 'CANCELLED', color: '#ef4444' },
};

export default function TournamentDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const primaryAccent = isLaunch ? '#22d3ee' : colors.primary;
  const tournamentId: string = route.params?.id;
  const cacheKey = useMemo(() => `tournament:${tournamentId}`, [tournamentId]);

  const [detail, setDetail] = useState<CharacterTournamentDetail | null>(null);
  const [myPollVote, setMyPollVote] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, 'A' | 'B'>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (force = false) => {
      const cached = force
        ? null
        : getScreenCache<{ detail: CharacterTournamentDetail; myPollVote: string | null }>(
            cacheKey,
            2 * 60_000
          );
      if (cached) {
        setDetail(cached.detail);
        setMyPollVote(cached.myPollVote ?? null);
        setMyVotes(cached.detail.myVotes || {});
        setLoading(false);
      }
      try {
        setError(null);
        const [d, poll] = await Promise.all([
          api.tournaments.detail(tournamentId),
          api.tournaments
            .pollVoteGet(tournamentId)
            .catch(() => ({ myPollVote: null as string | null })),
        ]);
        setDetail(d);
        setMyPollVote(poll.myPollVote ?? null);
        setMyVotes(d.myVotes || {});
        setScreenCache(cacheKey, { detail: d, myPollVote: poll.myPollVote ?? null });
      } catch {
        if (force || !getScreenCache(cacheKey)) setError('Could not load tournament');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey, tournamentId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const castVote = async (participantId: string) => {
    if (votingFor) return;
    setVotingFor(participantId);
    try {
      await api.tournaments.pollVoteCast(tournamentId, participantId);
      clearScreenCache(cacheKey);
      setMyPollVote(participantId);
      await fetchData(true);
    } catch (e: any) {
      Alert.alert('Vote failed', e?.message || 'Could not cast your vote');
    } finally {
      setVotingFor(null);
    }
  };

  /** Apply server-authoritative (or optimistic) counts to both round and flat lists. */
  const applyMatchCounts = (
    matchId: string,
    votesA: number,
    votesB: number,
    choice?: 'A' | 'B'
  ) => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            rounds: prev.rounds.map((round) => ({
              ...round,
              matches: round.matches.map((m) =>
                m.id === matchId ? { ...m, votesA, votesB } : m
              ),
            })),
            matches: prev.matches.map((m) =>
              m.id === matchId ? { ...m, votesA, votesB } : m
            ),
          }
        : prev
    );
    if (choice) setMyVotes((prev) => ({ ...prev, [matchId]: choice }));
  };

  const castMatchVote = async (match: TournamentMatch, choice: 'A' | 'B') => {
    if (votingMatch || myVotes[match.id]) return;
    const before = detail;
    setVotingMatch(match.id);
    setVoteError(null);
    // Optimistic so the tap feels instant; authoritative counts replace it.
    applyMatchCounts(
      match.id,
      match.votesA + (choice === 'A' ? 1 : 0),
      match.votesB + (choice === 'B' ? 1 : 0),
      choice
    );
    try {
      const result = await api.tournaments.matchVote(tournamentId, match.id, choice);
      applyMatchCounts(match.id, result.votesA, result.votesB, choice);
      clearScreenCache(cacheKey);
    } catch (e: any) {
      setDetail(before);
      setMyVotes(before?.myVotes || {});
      setVoteError(e?.message || 'Could not cast your vote');
    } finally {
      setVotingMatch(null);
    }
  };

  const runCreatorAction = async (action: 'start' | 'finalizeQualifying' | 'finalize') => {
    if (managing) return;
    const labels = {
      start: { title: 'Start this bracket?', body: 'Voting opens for every app and website user.' },
      finalizeQualifying: {
        title: 'Close qualifying now?',
        body: 'The top candidates move into the bracket for everyone.',
      },
      finalize: { title: 'Finalize this round?', body: 'Winners advance and the next round is created.' },
    };
    Alert.alert(labels[action].title, labels[action].body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: async () => {
          setManaging(action);
          try {
            if (action === 'start') await api.tournaments.start(tournamentId);
            else if (action === 'finalizeQualifying')
              await api.tournaments.finalizeQualifying(tournamentId);
            else await api.tournaments.finalize(tournamentId);
            clearScreenCache(cacheKey);
            await fetchData(true);
          } catch (e: any) {
            Alert.alert('Could not update', e?.message || 'Please try again.');
          } finally {
            setManaging(null);
          }
        },
      },
    ]);
  };

  const tournament = detail?.tournament;
  const meta = tournament ? STATUS_META[tournament.status] || { label: tournament.status, color: colors.textDim } : null;

  const sortedParticipants = useMemo(() => {
    if (!detail) return [];
    const parts = [...detail.tournament.participants];
    parts.sort((a, b) => (b.pollVotes || 0) - (a.pollVotes || 0));
    return parts;
  }, [detail]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (error && !detail) return <ErrorView message={error} onRetry={fetchData} />;
  if (!detail || !tournament) return <ErrorView message="Tournament not found" onRetry={fetchData} />;

  const isQualifying = tournament.mode === 'qualifying';

  const renderParticipant = ({ item, index }: { item: TournamentParticipant; index: number }) => {
    const rank = index + 1;
    const voted = myPollVote === item.id;
    const votes = item.pollVotes || 0;
    const imageUrl = item.charImage || item.franchiseCover;
    const accent = rank <= 3 ? '#34d399' : rank <= 16 ? '#22d3ee' : colors.textDim;
    const busy = votingFor === item.id;
    return (
      <FadeInView
        style={styles.participantCard}
        delay={Math.min(index * 30, 240)}
        offset={10}
        duration={320}
      >
        <View style={styles.participantPosterWrap}>
          {imageUrl ? (
            <SafeImage uri={imageUrl} style={styles.participantPoster} fallbackLabel={item.charName || 'Character'} />
          ) : (
            <View style={[styles.participantPoster, styles.participantPlaceholder]}>
              <Text style={styles.participantPlaceholderText}>{(item.charName || '?')[0]}</Text>
            </View>
          )}
          <View style={[styles.rankBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}66` }]}>
            <Text style={[styles.rankText, { color: accent }]}>#{rank}</Text>
          </View>
          {voted ? (
            <View style={styles.votedBadge}>
              <Text style={styles.votedBadgeText}>✓ Voted</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.participantCardBody}>
          <Text style={styles.participantName} numberOfLines={2}>{item.charName}</Text>
          <Text style={styles.participantVotes}>{votes} vote{votes === 1 ? '' : 's'}</Text>
          <TouchableOpacity
            style={[
              styles.voteButton,
              voted && styles.voteButtonVoted,
              myPollVote && !voted && styles.voteButtonDisabled,
            ]}
            disabled={!!myPollVote || busy}
            activeOpacity={0.8}
            onPress={() => castVote(item.id)}
          >
            <Text style={[styles.voteButtonText, voted && styles.voteButtonTextVoted]}>
              {busy ? 'Voting…' : voted ? '✓ Voted' : 'Vote'}
            </Text>
          </TouchableOpacity>
        </View>
      </FadeInView>
    );
  };

  const renderMatch = (m: TournamentMatch, roundLabel: string) => {
    const winnerA = m.winnerId === m.charA?.id;
    const winnerB = m.winnerId === m.charB?.id;
    const matchVotes = m.votesA + m.votesB;
    const totalPct = matchVotes > 0 ? (m.votesA / matchVotes) * 100 : 50;
    const avatar = (participant?: TournamentParticipant | null) => (
      <SafeImage
        uri={participant?.charImage || participant?.franchiseCover}
        style={styles.matchAvatar}
        fallbackLabel={(participant?.charName || '?').slice(0, 1)}
        resizeMode="cover"
      />
    );
    return (
      <View key={m.id} style={styles.matchCard}>
        <Text style={styles.roundLabel}>
          {roundLabel} · Match {m.position}
        </Text>
        <View style={styles.matchup}>
          <View style={styles.matchSide}>
            {avatar(m.charA)}
            <Text style={[styles.matchName, winnerA && styles.matchWinner]} numberOfLines={2}>
              {winnerA ? '🏆 ' : ''}{m.charA?.charName || 'TBD'}
            </Text>
            <Text style={styles.matchVotes}>{m.votesA}</Text>
          </View>
          <Text style={styles.matchVs}>vs</Text>
          <View style={[styles.matchSide, styles.matchSideRight]}>
            <Text style={styles.matchVotes}>{m.votesB}</Text>
            <Text style={[styles.matchName, styles.matchNameRight, winnerB && styles.matchWinner]} numberOfLines={2}>
              {winnerB ? '🏆 ' : ''}{m.charB?.charName || 'TBD'}
            </Text>
            {avatar(m.charB)}
          </View>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFillA, { width: `${totalPct}%` }]} />
        </View>
        {(() => {
          const myChoice = myVotes[m.id];
          const votingOpen =
            tournament.status === 'active' &&
            m.round === tournament.currentRound &&
            !!m.charA &&
            !!m.charB &&
            !m.winnerId;
          if (!votingOpen && !myChoice) return null;
          return (
            <View style={styles.matchVoteSection}>
              <Text style={styles.matchVoteLabel}>
                {myChoice ? 'YOUR VOTE IS IN' : 'CAST YOUR VOTE'}
              </Text>
              <View style={styles.matchVoteRow}>
                {(['A', 'B'] as const).map((side) => {
                  const char = side === 'A' ? m.charA : m.charB;
                  const chosen = myChoice === side;
                  const blocked = !!myChoice && !chosen;
                  const busy = votingMatch === m.id;
                  return (
                    <TouchableOpacity
                      key={side}
                      style={[
                        styles.matchVoteBtn,
                        chosen && styles.matchVoteBtnChosen,
                        blocked && styles.matchVoteBtnBlocked,
                      ]}
                      disabled={!!myChoice || !!busy}
                      activeOpacity={0.75}
                      accessibilityLabel={`Vote for ${char?.charName || side}`}
                      onPress={() => castMatchVote(m, side)}
                    >
                      <Text
                        style={[styles.matchVoteBtnText, chosen && styles.matchVoteBtnTextChosen]}
                        numberOfLines={1}
                      >
                        {busy ? '…' : chosen ? '✓ Your vote' : blocked ? 'Already voted' : `Vote ${char?.charName || side}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}
      </View>
    );
  };

  const rounds = detail.rounds || [];

  return (
    <FlatList
      data={isQualifying ? sortedParticipants : []}
      key={isQualifying ? 'qualifying-grid' : 'bracket-list'}
      keyExtractor={(item) => item.id}
      renderItem={renderParticipant}
      numColumns={isQualifying ? 2 : 1}
      columnWrapperStyle={isQualifying ? styles.participantColumn : undefined}
      showsVerticalScrollIndicator={false}
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: spacing.xxl, paddingHorizontal: spacing.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryAccent} />
      }
      ListHeaderComponent={
        <View>
          <FadeInView delay={0}>
            <Text style={styles.title}>{tournament.title}</Text>
            {meta ? (
              <View style={styles.chipRow}>
                <View style={[styles.chip, { borderColor: meta.color }]}>
                  <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                {tournament.creator ? (
                  <Text style={styles.creatorText}>by @{tournament.creator.username}</Text>
                ) : null}
              </View>
            ) : null}
            {tournament.description ? (
              <Text style={styles.description}>{tournament.description}</Text>
            ) : null}
            {!!voteError && <Text style={styles.voteError}>{voteError}</Text>}
            {detail.isCreator ? (
              <View style={styles.creatorPanel}>
                <Text style={styles.creatorPanelTitle}>CREATOR CONTROLS</Text>
                <View style={styles.creatorRow}>
                  {tournament.status === 'upcoming' ? (
                    <TouchableOpacity
                      style={styles.creatorBtn}
                      disabled={!!managing}
                      onPress={() => runCreatorAction('start')}
                    >
                      {managing === 'start' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.creatorBtnText}>▶ Start battle</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                  {tournament.status === 'qualifying' ? (
                    <TouchableOpacity
                      style={styles.creatorBtn}
                      disabled={!!managing}
                      onPress={() => runCreatorAction('finalizeQualifying')}
                    >
                      {managing === 'finalizeQualifying' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.creatorBtnText}>⚡ Close qualifying</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                  {tournament.status === 'active' ? (
                    <TouchableOpacity
                      style={styles.creatorBtn}
                      disabled={!!managing}
                      onPress={() => runCreatorAction('finalize')}
                    >
                      {managing === 'finalize' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.creatorBtnText}>🏁 Finalize round</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </FadeInView>

          {isQualifying && tournament.status === 'qualifying' ? (
            <FadeInView delay={60} style={styles.countdownCard}>
              <Countdown endsAt={tournament.qualifyingEndsAt} />
              <Text style={styles.countdownHint}>
                {detail.totalVotes} vote{detail.totalVotes === 1 ? '' : 's'} cast · one vote per app
              </Text>
            </FadeInView>
          ) : null}

          {isQualifying && tournament.status !== 'qualifying' ? (
            <FadeInView delay={60} style={styles.countdownCard}>
              <Text style={styles.countdownValue}> Qualifying has closed</Text>
              <Text style={styles.countdownHint}>
                {detail.totalVotes} votes cast in the poll
              </Text>
            </FadeInView>
          ) : null}

          {isQualifying ? (
            <FadeInView delay={110} style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>
                 Ranking · {sortedParticipants.length} candidates
              </Text>
              {myPollVote ? (
                <Text style={styles.votedHint}>You voted. Tap ✓ to change.</Text>
              ) : (
                <Text style={styles.votedHint}>Vote for your favorite!</Text>
              )}
            </FadeInView>
          ) : null}

          {!isQualifying ? (
            <FadeInView delay={110} style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>
                🏆 Bracket · Round {tournament.currentRound}/{tournament.totalRounds}
              </Text>
              <Text style={styles.countdownHint}>
                {detail.totalVotes} votes cast{meta?.label === 'LIVE' && tournament.roundEndsAt ? ` · next round in ${countdownLabel(tournament.roundEndsAt)}` : ''}
              </Text>
              {tournament.status === 'active' && (
                <Text style={styles.votedHint}>
                  Tap a side in a live matchup to cast your vote. One vote per matchup.
                </Text>
              )}
            </FadeInView>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !isQualifying && rounds.length > 0 ? (
          <View style={styles.bracketWrap}>
            {rounds.map((round) => (
              <View key={round.label}>
                <Text style={styles.bracketRoundTitle}>{round.label}</Text>
                {round.matches.map((m) => renderMatch(m, round.label))}
              </View>
            ))}
          </View>
        ) : isQualifying ? null : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matches yet</Text>
          </View>
        )
      }
    />
  );
}

function countdownLabel(endsAt?: string | null): string {
  if (!endsAt) return '';
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'closes today';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  creatorText: {
    color: colors.textDim,
    fontSize: fontSize.xs,
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  countdownCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  countdownValue: {
    color: colors.secondary,
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countdownHint: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  listHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  listHeaderTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  votedHint: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  participantColumn: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  participantCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  participantPosterWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: colors.surfaceLight,
  },
  participantPoster: {
    width: '100%',
    height: '100%',
  },
  participantPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantPlaceholderText: {
    color: colors.textDim,
    fontSize: 28,
    fontWeight: '800',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  rankText: {
    fontSize: 10,
    fontWeight: '900',
  },
  votedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(34,197,94,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  votedBadgeText: {
    color: '#052e16',
    fontSize: 10,
    fontWeight: '900',
  },
  participantCardBody: {
    padding: spacing.sm,
  },
  participantName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
    minHeight: 36,
  },
  participantVotes: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  voteButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  voteButtonVoted: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  voteButtonDisabled: {
    opacity: 0.35,
  },
  voteButtonText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  voteButtonTextVoted: {
    color: '#22c55e',
  },
  bracketWrap: {
    marginTop: spacing.xs,
  },
  bracketRoundTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  roundLabel: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  matchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  matchAvatar: {
    width: 38,
    height: 50,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
  },
  matchSideRight: {
    justifyContent: 'flex-end',
  },
  matchName: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  matchNameRight: {
    textAlign: 'right',
  },
  matchWinner: {
    color: '#34d399',
  },
  matchVotes: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  matchVs: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginHorizontal: spacing.sm,
  },
  barTrack: {
    height: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  barFillA: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  voteError: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  creatorPanel: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.primary}66`,
    backgroundColor: `${colors.primary}12`,
  },
  creatorPanelTitle: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  creatorBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorBtnText: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '900',
  },
  matchVoteSection: {
    marginTop: spacing.md,
  },
  matchVoteLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  matchVoteRow: {
    flexDirection: 'row',
    gap: 6,
  },
  matchVoteBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  matchVoteBtnChosen: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  matchVoteBtnBlocked: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  matchVoteBtnText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '800',
    textAlign: 'center',
  },
  matchVoteBtnTextChosen: {
    color: '#22c55e',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: fontSize.sm,
  },
}));