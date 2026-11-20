import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';

interface AnimePuzzle {
  title: string;
  year: number;
  format: 'TV' | 'Movie' | 'OVA';
  episodes: number;
  genres: string[];
  studio: string;
}

const PUZZLE_POOL: AnimePuzzle[] = [
  { title: 'Death Note', year: 2006, format: 'TV', episodes: 37, genres: ['Mystery', 'Supernatural', 'Suspense'], studio: 'Madhouse' },
  { title: 'Attack on Titan', year: 2013, format: 'TV', episodes: 87, genres: ['Action', 'Fantasy', 'Military'], studio: 'WIT Studio' },
  { title: 'Fullmetal Alchemist: Brotherhood', year: 2009, format: 'TV', episodes: 64, genres: ['Action', 'Adventure', 'Fantasy'], studio: 'Bones' },
  { title: 'Steins;Gate', year: 2011, format: 'TV', episodes: 24, genres: ['Sci-Fi', 'Suspense', 'Psychological'], studio: 'White Fox' },
  { title: 'Demon Slayer', year: 2019, format: 'TV', episodes: 55, genres: ['Action', 'Fantasy', 'Historical'], studio: 'ufotable' },
  { title: 'Jujutsu Kaisen', year: 2020, format: 'TV', episodes: 47, genres: ['Action', 'Supernatural', 'Fantasy'], studio: 'MAPPA' },
  { title: 'One Punch Man', year: 2015, format: 'TV', episodes: 24, genres: ['Action', 'Comedy', 'Super Power'], studio: 'Madhouse' },
  { title: 'Naruto Shippuden', year: 2007, format: 'TV', episodes: 500, genres: ['Action', 'Adventure', 'Martial Arts'], studio: 'Pierrot' },
  { title: 'Hunter x Hunter', year: 2011, format: 'TV', episodes: 148, genres: ['Action', 'Adventure', 'Fantasy'], studio: 'Madhouse' },
  { title: 'Solo Leveling', year: 2024, format: 'TV', episodes: 25, genres: ['Action', 'Fantasy'], studio: 'A-1 Pictures' },
  { title: 'Chainsaw Man', year: 2022, format: 'TV', episodes: 12, genres: ['Action', 'Supernatural', 'Horror'], studio: 'MAPPA' },
  { title: 'Spirited Away', year: 2001, format: 'Movie', episodes: 1, genres: ['Adventure', 'Supernatural', 'Fantasy'], studio: 'Studio Ghibli' },
  { title: 'Your Name.', year: 2016, format: 'Movie', episodes: 1, genres: ['Romance', 'Supernatural', 'Drama'], studio: 'CoMix Wave Films' },
  { title: 'Cowboy Bebop', year: 1998, format: 'TV', episodes: 26, genres: ['Action', 'Sci-Fi', 'Space'], studio: 'Sunrise' },
  { title: 'Tokyo Ghoul', year: 2014, format: 'TV', episodes: 12, genres: ['Action', 'Horror', 'Psychological'], studio: 'Pierrot' },
  { title: 'Spy x Family', year: 2022, format: 'TV', episodes: 37, genres: ['Action', 'Comedy'], studio: 'WIT Studio' },
  { title: 'Bleach', year: 2004, format: 'TV', episodes: 366, genres: ['Action', 'Adventure', 'Supernatural'], studio: 'Pierrot' },
  { title: 'My Hero Academia', year: 2016, format: 'TV', episodes: 138, genres: ['Action', 'School', 'Super Power'], studio: 'Bones' },
  { title: 'One Piece', year: 1999, format: 'TV', episodes: 1100, genres: ['Action', 'Adventure', 'Fantasy'], studio: 'Toei Animation' },
  { title: 'Frieren: Beyond Journey\'s End', year: 2023, format: 'TV', episodes: 28, genres: ['Adventure', 'Drama', 'Fantasy'], studio: 'Madhouse' },
];

const SUGGESTIONS = PUZZLE_POOL.map((p) => p.title);

interface GuessFeedback {
  guess: string;
  isCorrect: boolean;
  yearMatch: 'exact' | 'higher' | 'lower';
  formatMatch: boolean;
  episodesMatch: 'exact' | 'higher' | 'lower';
  sharedGenres: string[];
  guessAnime?: AnimePuzzle;
}

const STORAGE_KEY = 'zv_native_wordle_progress_v1';
const STATS_KEY = 'zv_native_wordle_stats_v1';

function getDailyPuzzle(): AnimePuzzle {
  const dateKey = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash << 5) - hash + dateKey.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PUZZLE_POOL.length;
  return PUZZLE_POOL[index];
}

export default function WordleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();
  const tint = isLaunch ? '#22d3ee' : '#00ff7c';

  const target = useMemo(() => getDailyPuzzle(), []);
  const [guesses, setGuesses] = useState<GuessFeedback[]>([]);
  const [input, setInput] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(false);
  const [stats, setStats] = useState({ played: 0, wins: 0, streak: 0 });

  const MAX_GUESSES = 6;

  // Load progress for today
  useEffect(() => {
    (async () => {
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.date === todayKey) {
            setGuesses(parsed.guesses || []);
            setGameOver(parsed.gameOver || false);
            setWon(parsed.won || false);
          }
        }
        const savedStats = await AsyncStorage.getItem(STATS_KEY);
        if (savedStats) setStats(JSON.parse(savedStats));
      } catch {}
    })();
  }, []);

  const autocomplete = useMemo(() => {
    if (!input.trim() || input.length < 2) return [];
    return SUGGESTIONS.filter(
      (s) => s.toLowerCase().includes(input.toLowerCase().trim()) && s.toLowerCase() !== input.toLowerCase().trim()
    ).slice(0, 4);
  }, [input]);

  const submitGuess = async (guessTitle?: string) => {
    const text = (guessTitle || input).trim();
    if (!text || gameOver) return;

    const matched = PUZZLE_POOL.find((p) => p.title.toLowerCase() === text.toLowerCase());
    const isExact = text.toLowerCase() === target.title.toLowerCase();

    const shared = matched
      ? matched.genres.filter((g) => target.genres.includes(g))
      : [];

    const feedback: GuessFeedback = {
      guess: matched ? matched.title : text,
      isCorrect: isExact,
      yearMatch: matched
        ? matched.year === target.year
          ? 'exact'
          : matched.year < target.year
          ? 'higher'
          : 'lower'
        : 'exact',
      formatMatch: matched ? matched.format === target.format : false,
      episodesMatch: matched
        ? matched.episodes === target.episodes
          ? 'exact'
          : matched.episodes < target.episodes
          ? 'higher'
          : 'lower'
        : 'exact',
      sharedGenres: shared,
      guessAnime: matched,
    };

    const nextGuesses = [...guesses, feedback];
    const isNowWon = isExact;
    const isNowOver = isNowWon || nextGuesses.length >= MAX_GUESSES;

    setGuesses(nextGuesses);
    setInput('');

    if (isNowOver) {
      setGameOver(true);
      setWon(isNowWon);

      const nextStats = {
        played: stats.played + 1,
        wins: stats.wins + (isNowWon ? 1 : 0),
        streak: isNowWon ? stats.streak + 1 : 0,
      };
      setStats(nextStats);
      try {
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
      } catch {}
    }

    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          date: todayKey,
          guesses: nextGuesses,
          gameOver: isNowOver,
          won: isNowWon,
        })
      );
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Anime Wordle"
        subtitle="Guess today's mystery anime (6 tries)"
        emoji="🟩"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats bar */}
          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: tint }]}>{stats.played}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>PLAYED</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: '#38bdf8' }]}>
                {stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>WIN %</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statNum, { color: '#f59e0b' }]}>{stats.streak}🔥</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>STREAK</Text>
            </View>
          </View>

          {/* Guesses list */}
          <View style={styles.guessesList}>
            {guesses.map((g, i) => (
              <FadeInView key={`${g.guess}-${i}`} delay={60} offset={10}>
                <View
                  style={[
                    styles.guessCard,
                    {
                      backgroundColor: g.isCorrect ? '#00ff7c1a' : colors.surface,
                      borderColor: g.isCorrect ? '#00ff7c' : colors.border,
                    },
                  ]}
                >
                  <View style={styles.guessHeader}>
                    <Text style={[styles.guessIndex, { color: colors.textDim }]}>#{i + 1}</Text>
                    <Text style={[styles.guessTitle, { color: colors.text }]}>{g.guess}</Text>
                    <Text style={{ fontSize: 16 }}>{g.isCorrect ? '✅' : '❌'}</Text>
                  </View>

                  {g.guessAnime && (
                    <View style={styles.hintTags}>
                      <View
                        style={[
                          styles.hintBadge,
                          {
                            backgroundColor:
                              g.yearMatch === 'exact'
                                ? '#00ff7c22'
                                : '#f59e0b22',
                            borderColor:
                              g.yearMatch === 'exact' ? '#00ff7c' : '#f59e0b',
                          },
                        ]}
                      >
                        <Text style={[styles.hintText, { color: g.yearMatch === 'exact' ? '#00ff7c' : '#f59e0b' }]}>
                          Year: {g.guessAnime.year}{' '}
                          {g.yearMatch === 'exact' ? '✓' : g.yearMatch === 'higher' ? '↑' : '↓'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.hintBadge,
                          {
                            backgroundColor: g.formatMatch ? '#00ff7c22' : '#ef444422',
                            borderColor: g.formatMatch ? '#00ff7c' : '#ef4444',
                          },
                        ]}
                      >
                        <Text style={[styles.hintText, { color: g.formatMatch ? '#00ff7c' : '#ef4444' }]}>
                          {g.guessAnime.format} {g.formatMatch ? '✓' : '✗'}
                        </Text>
                      </View>

                      {g.sharedGenres.length > 0 && (
                        <View style={[styles.hintBadge, { backgroundColor: '#38bdf822', borderColor: '#38bdf8' }]}>
                          <Text style={[styles.hintText, { color: '#38bdf8' }]}>
                            Genre: {g.sharedGenres.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </FadeInView>
            ))}

            {/* Empty slots remaining */}
            {!gameOver &&
              Array.from({ length: MAX_GUESSES - guesses.length }).map((_, idx) => (
                <View
                  key={`empty-${idx}`}
                  style={[styles.emptySlot, { borderColor: colors.border }]}
                >
                  <Text style={[styles.emptySlotText, { color: colors.textDim }]}>
                    Attempt {guesses.length + idx + 1} of {MAX_GUESSES}
                  </Text>
                </View>
              ))}
          </View>

          {/* Game Over Banner */}
          {gameOver && (
            <FadeInView delay={100}>
              <View
                style={[
                  styles.resultBox,
                  {
                    backgroundColor: won ? '#00ff7c1a' : '#ef44441a',
                    borderColor: won ? '#00ff7c' : '#ef4444',
                  },
                ]}
              >
                <Text style={{ fontSize: 32 }}>{won ? '🎉' : '💔'}</Text>
                <Text style={[styles.resultTitle, { color: won ? '#00ff7c' : '#ef4444' }]}>
                  {won ? 'Outstanding! You guessed it!' : 'Nice try!'}
                </Text>
                <Text style={[styles.answerText, { color: colors.text }]}>
                  Today's Anime: <Text style={{ fontWeight: '900', color: tint }}>{target.title}</Text>
                </Text>
                <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
                  {target.year} · {target.format} · {target.episodes} episodes · {target.genres.join(', ')}
                </Text>
                <Text style={[styles.nextPuzzleNote, { color: colors.textDim }]}>
                  A new puzzle drops tomorrow at midnight!
                </Text>
              </View>
            </FadeInView>
          )}

          {/* Input & Autocomplete */}
          {!gameOver && (
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Type an anime name (e.g. Death Note)"
                  placeholderTextColor={colors.textDim}
                  value={input}
                  onChangeText={setInput}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.guessBtn, { backgroundColor: tint }, !input.trim() && { opacity: 0.5 }]}
                  onPress={() => submitGuess()}
                  disabled={!input.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.guessBtnText}>Guess</Text>
                </TouchableOpacity>
              </View>

              {autocomplete.length > 0 && (
                <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {autocomplete.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggestItem, { borderBottomColor: colors.border }]}
                      onPress={() => submitGuess(s)}
                    >
                      <Text style={[styles.suggestText, { color: colors.text }]}>🔍 {s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Hint Card */}
          <TouchableOpacity
            style={[styles.hintCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setHintsRevealed((h) => !h)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 18 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hintCardTitle, { color: colors.text }]}>
                {hintsRevealed ? 'Studio Hint' : 'Need a hint? Tap to reveal studio'}
              </Text>
              {hintsRevealed && (
                <Text style={[styles.hintCardValue, { color: tint }]}>
                  Produced by Studio: {target.studio}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statCol: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  guessesList: { gap: 10 },
  guessCard: {
    padding: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  guessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guessIndex: { fontSize: 12, fontWeight: '800', marginRight: 8 },
  guessTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  hintTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  hintBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  hintText: { fontSize: 11, fontWeight: '700' },
  emptySlot: {
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: { fontSize: 12, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  guessBtn: {
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guessBtnText: { color: '#08090f', fontSize: 14, fontWeight: '900' },
  suggestions: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestText: { fontSize: 13, fontWeight: '600' },
  resultBox: {
    alignItems: 'center',
    padding: 20,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    marginVertical: spacing.md,
    gap: 6,
  },
  resultTitle: { fontSize: 18, fontWeight: '900' },
  answerText: { fontSize: 15, marginTop: 4 },
  resultMeta: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  nextPuzzleNote: { fontSize: 11, marginTop: 6 },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  hintCardTitle: { fontSize: 13, fontWeight: '700' },
  hintCardValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },
});

