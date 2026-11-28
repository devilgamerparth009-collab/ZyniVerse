import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api } from '../services/api';
import { absoluteAvatarUrl, cleanText, timeAgo } from '../utils/helpers';
import { openSafeWebUrl } from '../utils/safeLinks';
import { SocialAvatar, UserName } from '../components/social/SocialBits';
import { listLocalRecords, putLocalRecord } from '../services/localRepo';

const HOT_TAKE_COPY =
  "Got a hot take? Drop it. Share thoughts, theories, and opinions with fans who'll agree — or disagree.";

interface FeedItem {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  image?: string | null;
  href?: string | null;
  author?: { username?: string; avatar?: string | null; id?: string } | null;
  createdAt?: string;
  likes?: number;
  views?: number;
  local?: boolean;
}

type Mode = 'foryou' | 'following';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [mode, setMode] = useState<Mode>('foryou');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async (nextMode: Mode = mode) => {
    try {
      setError(null);
      const [localRecords, data] = await Promise.all([
        listLocalRecords<FeedItem>('feed:hot-takes'),
        api.feed.get(nextMode, 24),
      ]);
      const localItems: FeedItem[] = localRecords.map((record) => ({
        ...record.data,
        id: record.id,
        type: 'hot_take',
        local: true,
        createdAt: record.data.createdAt || new Date(record.updatedAt).toISOString(),
      }));
      setItems([...localItems, ...(data?.items || [])]);
    } catch (e: any) {
      setError(e?.message || 'Could not load your feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      load(mode);
    }, [load, mode])
  );

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setLoading(true);
    load(next);
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(mode);
  };

  const postHotTake = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await putLocalRecord<FeedItem>('feed:hot-takes', {
        id: `hot-${Date.now()}`,
        type: 'hot_take',
        body,
        author: null,
        createdAt: new Date().toISOString(),
        likes: 0,
        views: 0,
      });
      setDraft('');
      await load(mode);
    } catch (e: any) {
      setError(e?.message || 'Could not save your hot take');
    } finally {
      setPosting(false);
    }
  }, [draft, posting, load, mode]);

  const openItem = (item: FeedItem) => {
    if (item.local) return;
    if (item.author?.username) {
      navigation.navigate('UserProfile', { username: item.author.username });
      return;
    }
    if (item.href) {
      // Never open a foreign site. Same-origin paths are kept; anything else
      // falls back to the app's own feed page.
      openSafeWebUrl(item.href, '/feed');
    }
  };

  const renderItem = ({ item }: { item: FeedItem }) => {
    const author = item.author;
    const authorName = item.local ? 'You' : author?.username || 'ZyniVerse';
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openItem(item)}
        activeOpacity={0.85}
      >
        <View style={styles.authorRow}>
          <SocialAvatar uri={item.local ? undefined : author?.avatar} name={authorName} size={36} />
          <View style={{ flex: 1 }}>
            <UserName name={authorName} style={[styles.author, { color: colors.text }]} />
            <Text style={[styles.time, { color: colors.textDim }]}>
              {item.type?.replace(/_/g, ' ')}
              {item.createdAt ? ` · ${timeAgo(item.createdAt)}` : ''}
              {item.local ? ' · Saved on this device' : ''}
            </Text>
          </View>
        </View>

        {!!item.title && (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
            {cleanText(item.title)}
          </Text>
        )}
        {!!item.body && (
          <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={4}>
            {cleanText(item.body)}
          </Text>
        )}
        {!!item.image && (
          <Image source={{ uri: absoluteAvatarUrl(item.image) }} style={styles.image} resizeMode="cover" />
        )}

        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textDim }]}>❤️ {item.likes || 0}</Text>
          <Text style={[styles.meta, { color: colors.textDim }]}>👁️ {item.views || 0}</Text>
          <Text style={[styles.meta, { color: colors.primary }]}>Open →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Social Feed" emoji="📰" subtitle="What the community is posting" />

      <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.hotTakeCopy, { color: colors.text }]}>{HOT_TAKE_COPY}</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Drop your hot take…"
          placeholderTextColor={colors.textDim}
          style={[styles.composerInput, { color: colors.text }]}
          multiline
          maxLength={500}
        />
        <View style={styles.composerFooter}>
          <Text style={[styles.localNote, { color: colors.textDim }]}>Saved on this device</Text>
          <TouchableOpacity
            onPress={() => void postHotTake()}
            disabled={!draft.trim() || posting}
            style={[styles.postBtn, { backgroundColor: draft.trim() ? colors.primary : colors.surfaceLight }]}
          >
            <Text style={styles.postBtnText}>{posting ? 'Saving…' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'foryou' as Mode, label: 'For you' },
          { key: 'following' as Mode, label: 'Following' },
        ]).map((t) => {
          const active = mode === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
                { borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => switchMode(t.key)}
            >
              <Text style={[styles.tabText, { color: active ? '#0a0a0f' : colors.textMuted }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📰</Text>
              <Text style={[styles.empty, { color: colors.text }]}>Nothing here yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Write the first hot take above. Your posts stay saved on this device.
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {!!error && <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  composer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
  },
  hotTakeCopy: { fontSize: fontSize.xs, lineHeight: 17, fontWeight: '700' },
  composerInput: {
    minHeight: 48,
    maxHeight: 110,
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: '#00000022',
    fontSize: fontSize.sm,
    textAlignVertical: 'top',
  },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  localNote: { fontSize: 10 },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: borderRadius.full },
  postBtnText: { color: '#08090f', fontSize: 11, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1 },
  tabText: { fontSize: 11, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  author: { fontSize: fontSize.sm, fontWeight: '800' },
  time: { fontSize: 10, marginTop: 1, textTransform: 'capitalize' },
  title: { fontSize: fontSize.md, fontWeight: '800', marginTop: spacing.sm, lineHeight: 22 },
  body: { fontSize: fontSize.sm, lineHeight: 20, marginTop: 4 },
  image: { width: '100%', height: 180, borderRadius: borderRadius.md, marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, alignItems: 'center' },
  meta: { fontSize: 11, fontWeight: '700' },
  emptyBox: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  empty: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 4 },
  error: { fontSize: fontSize.xs, textAlign: 'center', paddingBottom: spacing.sm },
});
