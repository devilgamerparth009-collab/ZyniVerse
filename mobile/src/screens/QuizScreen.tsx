import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { QuizQuestion } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import Celebration from '../components/Celebration';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const tint = isDiwali ? '#f59e0b' : colors.primary;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [date, setDate] = useState('');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answer: string; explanation?: string } | null>(null);
  const [score, setScore] = useState(0);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [burst, setBurst] = useState(0);

  const progress = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fun.quiz.daily();
      setQuestions(data.questions || []);
      setDate(data.date || '');
      setIndex(0);
      setSelected(null);
      setResult(null);
      setScore(0);
      setFinished(false);
    } catch {
      setError('Could not load today\u2019s quiz. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (questions.length === 0) return;
    Animated.timing(progress, {
      toValue: (index + (result ? 1 : 0)) / questions.length,
      duration: 380,
      useNativeDriver: false,
    }).start();
  }, [index, result, questions.length, progress]);

  const current = questions[index];

  const choose = async (option: string) => {
    if (!current || selected || checking) return;
    setSelected(option);
    setChecking(true);
    try {
      const res = await api.fun.quiz.check(current.id, option);
      setResult({
        correct: res.correct,
        answer: res.correctAnswer || '',
        explanation: res.explanation,
      });
      if (res.correct) {
        setScore((s) => s + 1);
        setBurst((b) => b + 1);
      }
    } catch {
      // Network hiccup: let the user retry instead of guessing the result.
      setSelected(null);
      setResult(null);
      Alert.alert('Could not check answer', 'Please check your connection and try again.');
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      setBurst((b) => b + 1);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setResult(null);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Daily Quiz" emoji="🧠" subtitle="5 questions, one shot" />
        <View style={styles.center}>
          <ActivityIndicator color={tint} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Preparing today&apos;s questions…
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Daily Quiz" emoji="🧠" />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  if (finished || questions.length === 0) {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    const rank = pct === 100 ? 'Anime Sage' : pct >= 80 ? 'Otaku Elite' : pct >= 60 ? 'Senpai' : pct >= 40 ? 'Rookie' : 'Newbie';
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Daily Quiz" emoji="🧠" subtitle={date} />
        <Celebration trigger={burst} />
        <ScrollView contentContainerStyle={styles.resultWrap}>
          <FadeInView delay={40}>
            <Text style={styles.resultEmoji}>{pct >= 60 ? '🏆' : '💪'}</Text>
            <Text style={[styles.resultScore, { color: colors.text }]}>
              {score}
              <Text style={{ color: colors.textMuted, fontSize: 26 }}>/{questions.length || 5}</Text>
            </Text>
            <Text style={[styles.resultRank, { color: tint }]}>{rank}</Text>
            <Text style={[styles.resultMsg, { color: colors.textMuted }]}>
              {pct >= 80
                ? 'You clearly live and breathe anime. Respect.'
                : pct >= 40
                ? 'Solid run — a few more episodes and you\u2019ll ace it.'
                : 'Every legend starts somewhere. Try again tomorrow!'}
            </Text>
          </FadeInView>

          <FadeInView delay={160}>
            <PressableScale
              style={[styles.primaryBtn, { backgroundColor: tint }]}
              onPress={load}
            >
              <Text style={styles.primaryBtnText}>Play Again</Text>
            </PressableScale>
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.border }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.ghostBtnText, { color: colors.text }]}>Back to Fun Zone</Text>
            </TouchableOpacity>
          </FadeInView>
        </ScrollView>
      </View>
    );
  }

  const widthPct = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Daily Quiz"
        emoji="🧠"
        subtitle={`Question ${index + 1} of ${questions.length}`}
        right={
          <View style={[styles.scorePill, { borderColor: colors.border }]}>
            <Text style={[styles.scorePillText, { color: tint }]}>{score} pts</Text>
          </View>
        }
      />
      <Celebration trigger={burst} count={20} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}>
        {/* Progress */}
        <View style={[styles.track, { backgroundColor: colors.surface }]}>
          <Animated.View style={[styles.trackFill, { width: widthPct, backgroundColor: tint }]} />
        </View>

        <FadeInView key={current.id} delay={20}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chipRow}>
              <View style={[styles.chip, { backgroundColor: `${tint}22` }]}>
                <Text style={[styles.chipText, { color: tint }]}>{current.category}</Text>
              </View>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: `${DIFFICULTY_COLOR[current.difficulty] || colors.textMuted}22` },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: DIFFICULTY_COLOR[current.difficulty] || colors.textMuted },
                  ]}
                >
                  {String(current.difficulty || 'normal').toUpperCase()}
                </Text>
              </View>
            </View>

            {!!current.animeImage && (
              <Image source={{ uri: current.animeImage }} style={styles.animeImage} resizeMode="cover" />
            )}

            <Text style={[styles.question, { color: colors.text }]}>{current.question}</Text>
            {!!current.animeTitle && (
              <Text style={[styles.animeHint, { color: colors.textDim }]}>from {current.animeTitle}</Text>
            )}
          </View>
        </FadeInView>

        {current.options.map((option, i) => {
          const isSelected = selected === option;
          const isCorrectAnswer =
            !!result && result.answer && option.trim().toLowerCase() === result.answer.trim().toLowerCase();
          const isWrongPick = !!result && isSelected && !result.correct;

          let borderColor = colors.border;
          let bg = colors.surface;
          let textColor = colors.text;
          if (isCorrectAnswer) {
            borderColor = '#22c55e';
            bg = 'rgba(34,197,94,0.14)';
            textColor = '#22c55e';
          } else if (isWrongPick) {
            borderColor = '#ef4444';
            bg = 'rgba(239,68,68,0.14)';
            textColor = '#ef4444';
          } else if (isSelected) {
            borderColor = tint;
            bg = `${tint}18`;
          }

          return (
            <FadeInView key={option} delay={60 + i * 55} offset={10}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!!selected}
                onPress={() => choose(option)}
                style={[styles.option, { backgroundColor: bg, borderColor }]}
              >
                <Text style={[styles.optionLetter, { color: textColor }]}>
                  {String.fromCharCode(65 + i)}
                </Text>
                <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
                {isCorrectAnswer && <Text style={styles.optionMark}>✓</Text>}
                {isWrongPick && <Text style={styles.optionMark}>✕</Text>}
              </TouchableOpacity>
            </FadeInView>
          );
        })}

        {result && (
          <FadeInView delay={40}>
            <View
              style={[
                styles.feedback,
                {
                  borderColor: result.correct ? '#22c55e' : '#ef4444',
                  backgroundColor: result.correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                },
              ]}
            >
              <Text
                style={[
                  styles.feedbackTitle,
                  { color: result.correct ? '#22c55e' : '#ef4444' },
                ]}
              >
                {result.correct ? 'Correct! 🎉' : 'Not quite 😅'}
              </Text>
              {!result.correct && !!result.answer && (
                <Text style={[styles.feedbackBody, { color: colors.text }]}>
                  Answer: <Text style={{ fontWeight: '800' }}>{result.answer}</Text>
                </Text>
              )}
              {!!result.explanation && (
                <Text style={[styles.feedbackBody, { color: colors.textMuted }]}>
                  {result.explanation}
                </Text>
              )}
            </View>

            <PressableScale style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={next}>
              <Text style={styles.primaryBtnText}>
                {index + 1 >= questions.length ? 'See Results' : 'Next Question →'}
              </Text>
            </PressableScale>
          </FadeInView>
        )}
      </ScrollView>
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
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginRight: 6,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  animeImage: {
    width: '100%',
    height: 130,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  question: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    lineHeight: 25,
  },
  animeHint: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  optionLetter: {
    width: 26,
    fontSize: fontSize.sm,
    fontWeight: '900',
    opacity: 0.8,
  },
  optionText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  optionMark: {
    fontSize: fontSize.md,
    fontWeight: '900',
    color: '#22c55e',
  },
  feedback: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  feedbackTitle: {
    fontSize: fontSize.md,
    fontWeight: '900',
    marginBottom: 4,
  },
  feedbackBody: {
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginTop: 2,
  },
  scorePill: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  resultWrap: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  resultScore: {
    fontSize: 56,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultRank: {
    fontSize: fontSize.lg,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 2,
  },
  resultMsg: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: '#08090f',
    fontSize: fontSize.md,
    fontWeight: '900',
  },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ghostBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
