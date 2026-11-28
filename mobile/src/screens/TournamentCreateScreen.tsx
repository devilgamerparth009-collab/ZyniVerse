import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { api, TournamentCharacterResult } from '../services/api';
import { clearScreenCache } from '../utils/screenCache';
import SafeImage from '../components/SafeImage';

type Mode = 'bracket' | 'qualifying';

const BRACKET_SIZES = [8, 16, 32];
const QUALIFYING_POOLS = [16, 32, 64];
const QUICK_SEARCHES = ['Frieren', 'Luffy', 'Naruto', 'Goku', 'Gojo', 'Sakura'];

function Chip({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active?: boolean;
  tint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        {
          borderColor: active ? tint : colors.border,
          backgroundColor: active ? `${tint}22` : colors.surface,
        },
      ]}
    >
      <Text style={{ color: active ? tint : colors.textMuted, fontWeight: '800', fontSize: 12 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TournamentCreateScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<Mode>('bracket');
  const [size, setSize] = useState(16);
  const [bracketSize, setBracketSize] = useState(16);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TournamentCharacterResult[]>([]);
  const [selected, setSelected] = useState<TournamentCharacterResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestId = useRef(0);

  const poolSizes = mode === 'qualifying' ? QUALIFYING_POOLS : BRACKET_SIZES;
  const validSize = poolSizes.includes(size);
  const canSubmit =
    title.trim().length >= 3 && selected.length === size && validSize && !submitting;

  useEffect(() => {
    setSize(mode === 'qualifying' ? 16 : 16);
  }, [mode]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const current = ++requestId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await api.searchTournamentCharacters(q);
        if (current === requestId.current) setResults(found);
      } catch {
        if (current === requestId.current) setResults([]);
      } finally {
        if (current === requestId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleCharacter = useCallback(
    (character: TournamentCharacterResult) => {
      setSelected((prev) => {
        const exists = prev.some((item) => item.id === character.id);
        if (exists) return prev.filter((item) => item.id !== character.id);
        if (prev.length >= size) return prev;
        return [...prev, character];
      });
    },
    [size]
  );

  const submit = async () => {
    if (!canSubmit) return;
    if (!(await api.auth.isLoggedIn())) {
      Alert.alert('Sign in needed', 'Sign in to create a tournament that appears for everyone.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.tournaments.create({
        title: title.trim(),
        description: description.trim() || undefined,
        size,
        mode,
        bracketSize: mode === 'qualifying' ? bracketSize : size,
        participants: selected.map((item) => ({
          charId: item.id,
          charName: item.name,
          charImage: item.image,
        })),
      });
      clearScreenCache();
      Alert.alert('Tournament created', 'Your event is live for app and website users.', [
        {
          text: 'Open it',
          onPress: () =>
            navigation.navigate('TournamentDetail', {
              id: String(created?.id || ''),
              title: title.trim(),
            }),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Could not create', error?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderResult = (item: TournamentCharacterResult) => {
    const chosen = selected.some((p) => p.id === item.id);
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => toggleCharacter(item)}
        activeOpacity={0.8}
        style={[
          styles.resultRow,
          {
            backgroundColor: colors.surface,
            borderColor: chosen ? colors.primary : colors.border,
          },
        ]}
      >
        <SafeImage
          uri={item.image}
          style={styles.resultAvatar}
          fallbackLabel={item.name}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 10 }}>
            ♥ {(item.favourites || 0).toLocaleString()} · AniList
          </Text>
        </View>
        <Text style={{ color: chosen ? colors.primary : colors.textDim, fontWeight: '900' }}>
          {chosen ? '✓' : '+'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.primary }]}>TOURNAMENT NAME</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Best Isekai Hero 2026"
          placeholderTextColor={colors.textDim}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.primary }]}>DESCRIPTION</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell everyone what this battle is about"
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.multiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.primary }]}>MODE</Text>
        <View style={styles.chipRow}>
          <Chip label="⚔️ Bracket" active={mode === 'bracket'} tint={colors.primary} onPress={() => setMode('bracket')} />
          <Chip label="⚡ Qualifying poll" active={mode === 'qualifying'} tint={colors.secondary} onPress={() => setMode('qualifying')} />
        </View>

        <Text style={[styles.label, { color: colors.primary, marginTop: 16 }]}>
          {mode === 'qualifying' ? 'CHARACTER POOL' : 'BRACKET SIZE'}
        </Text>
        <View style={styles.chipRow}>
          {poolSizes.map((value) => (
            <Chip
              key={value}
              label={`${value}`}
              active={size === value}
              tint={colors.primary}
              onPress={() => setSize(value)}
            />
          ))}
        </View>

        {mode === 'qualifying' ? (
          <>
            <Text style={[styles.label, { color: colors.primary, marginTop: 16 }]}>FINAL BRACKET</Text>
            <View style={styles.chipRow}>
              {BRACKET_SIZES.map((value) => (
                <Chip
                  key={value}
                  label={`${value}`}
                  active={bracketSize === value}
                  tint={colors.secondary}
                  onPress={() => setBracketSize(value)}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.primary }]}>ADD CHARACTERS</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Search runs directly on AniList. Pick exactly {size} characters.
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a character"
          placeholderTextColor={colors.textDim}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />
        <View style={styles.chipRow}>
          {QUICK_SEARCHES.map((term) => (
            <Chip key={term} label={term} tint={colors.secondary} onPress={() => setQuery(term)} />
          ))}
        </View>

        {searching ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, marginLeft: 8 }}>Searching AniList…</Text>
          </View>
        ) : null}
        {results.length > 0 ? results.map(renderResult) : null}
        {!searching && query.trim().length >= 2 && results.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textDim }]}>No characters found.</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.selectedTitle, { color: colors.text }]}>
          Selected {selected.length}/{size}
        </Text>
        {selected.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textDim }]}>Nothing selected yet.</Text>
        ) : (
          <View style={styles.chipRow}>
            {selected.map((item) => (
              <Chip
                key={item.id}
                label={`${item.name} ×`}
                active
                tint={colors.primary}
                onPress={() => toggleCharacter(item)}
              />
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={submit}
        disabled={!canSubmit}
        activeOpacity={0.85}
        style={[
          styles.submit,
          { backgroundColor: canSubmit ? colors.primary : colors.surface, borderColor: colors.border },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.submitText, { color: canSubmit ? '#fff' : colors.textDim }]}>
            Create tournament
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 16, paddingVertical: 14 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  hint: { fontSize: 11, lineHeight: 16, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 12,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  inlineLoader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  resultAvatar: { width: 44, height: 56, borderRadius: 8, overflow: 'hidden' },
  selectedTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  submit: {
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
  },
  submitText: { fontSize: 14, fontWeight: '900' },
});
