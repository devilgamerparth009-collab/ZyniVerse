import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import Celebration from '../components/Celebration';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';

type Mode = 'plot' | 'silhouette' | 'ost';

const MODE_META: Record<Mode, { title: string; emoji: string; tagline: string; tint: string }> = {
  plot: {
    title: 'Guess the Plot',
    emoji: '📖',
    tagline: 'Read the synopsis, name the anime. Six tries.',
    tint: '#a855f7',
  },
  silhouette: {
    title: 'Silhouette',
    emoji: '🕵️',
    tagline: 'Who is hiding in the shadows? Six tries.',
    tint: '#f472b6',
  },
  ost: {
    title: 'Guess the OST',
    emoji: '🎵',
    tagline: 'Which anime does this opening belong to?',
    tint: '#f59e0b',
  },
};

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDiwali } = useTheme();

  const mode: Mode =
    route.params?.mode === 'silhouette' || route.params?.mode === 'ost' ? route.params.mode : 'plot';
  const meta = MODE_META[mode];
  const tint = isDiwali ? '#f59e0b' : meta.tint;

  const [game, setGame] = useState<any>(null);
  const [guess, setGuess] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [peek, setPeek] = useState(false);

  const reveal = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGuess('');
    setHints([]);
    setAttempts(0);
    setResult(null);
    setPeek(false);
    reveal.setValue(0);
    try {
      const data = await api.fun.game.get(mode);
      setGame(data);
    } catch {
      setError('Could not load today\u2019s puzzle. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, reveal]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!guess.trim() || result?.gameOver) return;
    try {
      const res = await api.fun.game.guess(mode, guess.trim(), attempts);
      setResult(res);
      setAttempts(res.attempts);
      setHints(res.hints || []);
      if (res.correct) setBurst((b) => b + 1);
      setGuess('');
    } catch {
      setHints((h) => [...h, 'Network hiccup — try that guess again.']);
    }
  };

  const doPeek = () => {
    setPeek(true);
    Animated.timing(reveal, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  const gameOver = !!result?.gameOver;
  const won = !!result?.correct;
  const remaining = Math.max(0, 6 - attempts);
  const overlayOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.93, 0.25] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={meta.title} emoji={meta.emoji} subtitle={meta.tagline} accent={tint} />
      <Celebration trigger={burst} count={22} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tint} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading the puzzle…</Text>
        </View>
      ) : error ? (
        <ErrorView message={error} onRetry={load} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Attempts */}
            <View style={styles.attemptRow}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.attemptDot,
                    {
                      backgroundColor: i < attempts ? (gameOver && !won ? '#ef4444' : tint) : colors.border,
                    },
                  ]}
                />
              ))}
              <Text style={[styles.attemptText, { color: colors.textMuted }]}>
                {gameOver ? (won ? 'Solved!' : 'Out of tries') : `${remaining} left`}
              </Text>
            </View>

            {/* Puzzle card */}
            <FadeInView delay={20}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {mode === 'plot' && (
                  <>
                    <Text style={[styles.kicker, { color: tint }]}>📖 THE PLOT</Text>
                    <Text style={[styles.plot, { color: colors.text }]}>{game?.plot}</Text>
                    <View style={styles.chipRow}>
                      {(game?.genres || []).map((g: string) => (
                        <View key={g} style={[styles.chip, { backgroundColor: `${tint}1f` }]}>
                          <Text style={[styles.chipText, { color: tint }]}>{g}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {mode === 'silhouette' && (
                  <>
                    <Text style={[styles.kicker, { color: tint }]}>🕵️ WHO IS THIS?</Text>
                    <View style={styles.silhouetteWrap}>
                      <Image
                        source={{ uri: game?.imageUrl }}
                        style={styles.silhouetteImage}
                        resizeMode="contain"
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.silhouetteOverlay, { opacity: overlayOpacity }]}
                      />
                      {!peek && !gameOver && (
                        <TouchableOpacity style={styles.peekBtn} onPress={doPeek}>
                          <Text style={styles.peekText}>👀 Peek</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}

                {mode === 'ost' && (
                  <>
                    <Text style={[styles.kicker, { color: tint }]}>🎵 NOW PLAYING</Text>
                    <View style={styles.ostVisual}>
                      <Text style={styles.ostNote}>🎧</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ostSong, { color: colors.text }]} numberOfLines={2}>
                          {game?.song}
                        </Text>
                        <Text style={[styles.ostArtist, { color: colors.textMuted }]}>
                          {game?.artist} · {game?.type}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.ostPrompt, { color: colors.textDim }]}>
                      Which anime is this from?
                    </Text>
                  </>
                )}

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.hintLabel, { color: colors.textDim }]}>HINT</Text>
                <Text style={[styles.hintText, { color: colors.textMuted }]}>
                  {mode === 'plot' ? game?.genres?.join(', ') : game?.hint}
                </Text>
              </View>
            </FadeInView>

            {/* Guess input */}
            {!gameOver && (
              <FadeInView delay={80}>
                <View style={styles.inputRow}>
                  <TextInput
                    value={guess}
                    onChangeText={setGuess}
                    placeholder={
                      mode === 'silhouette' ? 'Character or anime name…' : 'Type the anime name…'
                    }
                    placeholderTextColor={colors.textDim}
                    style={[
                      styles.input,
                      { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                    ]}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={submit}
                  />
                  <PressableScale
                    style={[styles.guessBtn, { backgroundColor: tint, opacity: guess.trim() ? 1 : 0.5 }]}
                    onPress={submit}
                    disabled={!guess.trim()}
                  >
                    <Text style={styles.guessBtnText}>Guess</Text>
                  </PressableScale>
                </View>
              </FadeInView>
            )}

            {/* Hints */}
            {hints.length > 0 && (
              <View style={styles.hintList}>
                {hints.map((h, i) => (
                  <FadeInView key={`${i}-${h}`} delay={i * 60} offset={8}>
                    <View
                      style={[
                        styles.hintBubble,
                        {
                          backgroundColor: won ? 'rgba(34,197,94,0.12)' : `${tint}12`,
                          borderColor: won ? '#22c55e' : `${tint}55`,
                        },
                      ]}
                    >
                      <Text style={[styles.hintBubbleText, { color: colors.text }]}>{h}</Text>
                    </View>
                  </FadeInView>
                ))}
              </View>
            )}

            {/* Result */}
            {gameOver && (
              <FadeInView delay={60}>
                <View
                  style={[
                    styles.resultCard,
                    {
                      borderColor: won ? '#22c55e' : '#ef4444',
                      backgroundColor: won ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    },
                  ]}
                >
                  <Text style={[styles.resultTitle, { color: won ? '#22c55e' : '#ef4444' }]}>
                    {won ? 'You got it! 🎉' : 'The answer was…'}
                  </Text>
                  <Text style={[styles.resultAnswer, { color: colors.text }]}>
                    {result?.target?.title ||
                      result?.target?.character ||
                      (mode === 'ost' ? game?.song : '')}
                  </Text>
                  {!!result?.target?.anime && (
                    <Text style={[styles.resultSub, { color: colors.textMuted }]}>
                      from {result.target.anime}
                    </Text>
                  )}

                  {!!result?.target?.mediaId && (
                    <PressableScale
                      style={[styles.primaryBtn, { backgroundColor: tint }]}
                      onPress={() =>
                        navigation.navigate('AnimeDetail', {
                          id: result.target.mediaId,
                          title: result?.target?.title || result?.target?.anime,
                        })
                      }
                    >
                      <Text style={styles.primaryBtnText}>Open Anime Page →</Text>
                    </PressableScale>
                  )}
                </View>

                <PressableScale
                  style={[styles.ghostBtn, { borderColor: colors.border }]}
                  onPress={load}
                >
                  <Text style={[styles.ghostBtnText, { color: colors.text }]}>Replay puzzle</Text>
                </PressableScale>

                <View style={styles.modeRow}>
                  {(Object.keys(MODE_META) as Mode[])
                    .filter((m) => m !== mode)
                    .map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.modeChip, { borderColor: colors.border }]}
                        onPress={() => navigation.replace('Games', { mode: m })}
                      >
                        <Text style={[styles.modeChipText, { color: colors.textMuted }]}>
                          {MODE_META[m].emoji} {MODE_META[m].title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </FadeInView>
            )}

            <Text style={[styles.footerNote, { color: colors.textDim }]}>
              A new puzzle drops every day. Come back tomorrow for a fresh one.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  attemptDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  attemptText: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  plot: {
    fontSize: fontSize.md,
    lineHeight: 24,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  chip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  silhouetteWrap: {
    height: 240,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#05060a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteImage: {
    width: '100%',
    height: '100%',
  },
  silhouetteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  peekBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  peekText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  ostVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  ostNote: {
    fontSize: 34,
    marginRight: spacing.md,
  },
  ostSong: {
    fontSize: fontSize.lg,
    fontWeight: '900',
  },
  ostArtist: {
    fontSize: fontSize.xs,
    marginTop: 3,
  },
  ostPrompt: {
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  hintLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  hintText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: fontSize.sm,
    marginRight: spacing.sm,
  },
  guessBtn: {
    borderRadius: borderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  guessBtnText: {
    color: '#08090f',
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
  hintList: {
    marginBottom: spacing.sm,
  },
  hintBubble: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: 6,
  },
  hintBubbleText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: '900',
    marginBottom: 4,
  },
  resultAnswer: {
    fontSize: fontSize.xl,
    fontWeight: '900',
  },
  resultSub: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  primaryBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: {
    color: '#08090f',
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ghostBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  modeChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
