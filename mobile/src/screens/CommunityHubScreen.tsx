import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { listLocalRecords, putLocalRecord } from '../services/localRepo';

interface LocalClub {
  slug: string;
  name: string;
  topic: string;
  description: string;
  emoji: string;
  joined: boolean;
  createdAt: number;
}

const STARTER_CLUBS: Omit<LocalClub, 'joined' | 'createdAt'>[] = [
  {
    slug: 'hindi-dub-fans',
    name: 'Hindi Dub Fans',
    topic: 'Dubbed anime',
    description: 'Share your favourite Hindi dub moments and episode reactions.',
    emoji: '🇮🇳',
  },
  {
    slug: 'shonen-corner',
    name: 'Shonen Corner',
    topic: 'Action',
    description: 'Theories, fight takes and weekly episode discussions.',
    emoji: '⚔️',
  },
  {
    slug: 'slice-of-life',
    name: 'Slice of Life Club',
    topic: 'Slice of Life',
    description: 'Cosy shows, comfort rewatches and character favourites.',
    emoji: '🍵',
  },
  {
    slug: 'manga-readers',
    name: 'Manga Readers',
    topic: 'Manga',
    description: 'Chapter reactions, reading order help and recommendations.',
    emoji: '📚',
  },
];

export default function CommunityHubScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();

  const [clubs, setClubs] = useState<LocalClub[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const records = await listLocalRecords<LocalClub>('community:clubs');
    const saved = new Map(records.map((record) => [record.data.slug, record.data]));
    const merged = STARTER_CLUBS.map((club) => ({
      ...club,
      joined: saved.get(club.slug)?.joined ?? false,
      createdAt: saved.get(club.slug)?.createdAt ?? Date.now(),
    }));
    const custom = records
      .map((record) => record.data)
      .filter((club) => !STARTER_CLUBS.some((starter) => starter.slug === club.slug));
    if (mounted.current) setClubs([...custom, ...merged]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleJoin = useCallback(
    async (club: LocalClub) => {
      const next = { ...club, joined: !club.joined, createdAt: Date.now() };
      await putLocalRecord('community:clubs', next, club.slug);
      await load();
    },
    [load]
  );

  const createClub = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = `local-${Date.now()}`;
    await putLocalRecord<LocalClub>(
      'community:clubs',
      {
        slug,
        name: trimmed,
        topic: topic.trim() || 'General',
        description: 'A community you created on this device.',
        emoji: '🧩',
        joined: true,
        createdAt: Date.now(),
      },
      slug
    );
    setName('');
    setTopic('');
    setShowForm(false);
    await load();
  }, [name, topic, load]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Communities"
        emoji="🏛️"
        subtitle="Every fandom has a home"
        right={
          <TouchableOpacity
            onPress={() => setShowForm((value) => !value)}
            accessibilityLabel={showForm ? 'Close create club form' : 'Create a club'}
            style={[styles.headerBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.headerBtnText, { color: theme.text }]}>{showForm ? '✕' : '+'}</Text>
          </TouchableOpacity>
        }
      />

      <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Find your people</Text>
        <Text style={[styles.heroBody, { color: theme.textMuted }]}>
          Join communities built around your favourite anime and genres. Your clubs are saved on this device.
        </Text>
        <View style={styles.heroActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Feed')}
            style={[styles.heroBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.heroBtnText}>Share a hot take</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('LocalChats')}
            style={[styles.heroBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.heroBtnOutline, { color: theme.text }]}>Open chats</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showForm && (
        <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Club name"
            placeholderTextColor={theme.textDim}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Topic (optional)"
            placeholderTextColor={theme.textDim}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <TouchableOpacity onPress={() => void createClub()} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.createText}>Create club</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={clubs}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => void toggleJoin(item)}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={styles.cardEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[styles.cardTopic, { color: theme.primary }]}>{item.topic}</Text>
              <Text style={[styles.cardBody, { color: theme.textMuted }]} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
            <Text style={[styles.join, { color: item.joined ? '#22c55e' : theme.textDim }]}>
              {item.joined ? 'JOINED' : 'JOIN'}
            </Text>
          </PressableScale>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  hero: { margin: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  heroTitle: { fontSize: fontSize.md, fontWeight: '900' },
  heroBody: { fontSize: fontSize.xs, lineHeight: 18, marginTop: 6 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  heroBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full },
  heroBtnText: { color: '#08090f', fontSize: 10, fontWeight: '900' },
  heroBtnOutline: { fontSize: 10, fontWeight: '800' },
  form: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm },
  input: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 10, height: 38, fontSize: fontSize.sm, marginBottom: 8 },
  createBtn: { paddingVertical: 9, borderRadius: borderRadius.full, alignItems: 'center' },
  createText: { color: '#08090f', fontSize: fontSize.xs, fontWeight: '900' },
  card: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  cardEmoji: { fontSize: 26, width: 30, textAlign: 'center' },
  cardTitle: { fontSize: fontSize.sm, fontWeight: '800' },
  cardTopic: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  cardBody: { fontSize: fontSize.xs, marginTop: 4 },
  join: { fontSize: 9, fontWeight: '900', alignSelf: 'center' },
});
