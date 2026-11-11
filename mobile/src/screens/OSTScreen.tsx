import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { OSTEntry } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import ErrorView from '../components/ErrorView';
import { spacing, fontSize, borderRadius } from '../theme';

const TYPES = [
  { key: '', label: 'All' },
  { key: 'OP', label: 'Openings' },
  { key: 'ED', label: 'Endings' },
  { key: 'OST', label: 'Soundtracks' },
  { key: 'INSERT', label: 'Inserts' },
];

const TYPE_COLOR: Record<string, string> = {
  OP: '#22d3ee',
  ED: '#f472b6',
  OST: '#f59e0b',
  INSERT: '#a855f7',
  CHARACTER: '#22c55e',
};

function Vinyl({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.vinyl, { borderColor: color, transform: [{ rotate }] }]}>
      <View style={[styles.vinylCore, { backgroundColor: color }]} />
    </Animated.View>
  );
}

export default function OSTScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDiwali } = useTheme();
  const tint = isDiwali ? '#f59e0b' : colors.primary;

  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [items, setItems] = useState<OSTEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string, kind: string) => {
    setError(null);
    try {
      const data = await api.fun.osts({ search: search || undefined, type: kind || undefined, limit: 60 });
      setItems(data.osts || []);
      setTotal(data.total || 0);
    } catch {
      setError('Could not load the soundtrack vault.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => load(query, type), query ? 420 : 0);
    return () => clearTimeout(t);
  }, [query, type, load]);

  const play = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="OP & ED Vault"
        emoji="🎧"
        subtitle="Every legendary opening in one place"
        accent={tint}
        right={<Vinyl color={tint} />}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search anime, song or artist…"
            placeholderTextColor={colors.textDim}
            style={[
              styles.search,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TYPES.map((t) => {
            const active = type === t.key;
            return (
              <TouchableOpacity
                key={t.key || 'all'}
                onPress={() => setType(t.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? tint : colors.surface,
                    borderColor: active ? tint : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#08090f' : colors.textMuted, fontWeight: active ? '900' : '600' },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tint} size="large" />
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={() => load(query, type)} />
        ) : (
          <View style={{ paddingHorizontal: spacing.md }}>
            <Text style={[styles.count, { color: colors.textDim }]}>
              {total} track{total === 1 ? '' : 's'}
            </Text>

            {items.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>🎵</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No tracks matched that search.
                </Text>
              </View>
            )}

            {items.map((item, i) => {
              const c = TYPE_COLOR[item.type] || colors.textMuted;
              return (
                <FadeInView key={item.id} delay={Math.min(i * 30, 400)} offset={8}>
                  <PressableScale onPress={() => play(item.videoUrl)}>
                    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={[styles.typeBadge, { backgroundColor: `${c}22`, borderColor: c }]}>
                        <Text style={[styles.typeText, { color: c }]}>{item.type}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.song, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.anime, { color: colors.textMuted }]} numberOfLines={1}>
                          {item.animeTitle} · {item.artist}
                        </Text>
                        <Text style={[styles.year, { color: colors.textDim }]}>
                          {item.year}
                          {item.season ? ` · ${item.season}` : ''}
                          {item.composer ? ` · ${item.composer}` : ''}
                        </Text>
                      </View>
                      {!!item.videoUrl && (
                        <View style={[styles.playBtn, { backgroundColor: `${c}22` }]}>
                          <Text style={[styles.playIcon, { color: c }]}>▶</Text>
                        </View>
                      )}
                    </View>
                  </PressableScale>
                </FadeInView>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  vinyl: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  searchWrap: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.sm,
  },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginRight: spacing.sm,
  },
  chipText: {
    fontSize: 11,
  },
  center: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 6,
    marginRight: spacing.sm,
    minWidth: 44,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  song: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  anime: {
    fontSize: 11,
    marginTop: 2,
  },
  year: {
    fontSize: 10,
    marginTop: 1,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  playIcon: {
    fontSize: 13,
    marginLeft: 1,
  },
});
