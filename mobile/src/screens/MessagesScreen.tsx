import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api, ChatConversation, ChatUserRef } from '../services/api';
import { absoluteAvatarUrl, timeAgo } from '../utils/helpers';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatUserRef[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await api.chat.conversations();
      setConversations(list);
    } catch (e: any) {
      setError(e?.message || 'Could not load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const runSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await api.chat.searchUsers(text));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openChat = (conversation: ChatConversation) => {
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      username: conversation.otherUser?.username || 'Chat',
      avatar: conversation.otherUser?.avatar || undefined,
    });
  };

  const startChat = async (user: ChatUserRef) => {
    setQuery('');
    setResults([]);
    navigation.navigate('Chat', {
      userId: user.id,
      username: user.username,
      avatar: user.avatar || undefined,
    });
  };

  const renderRow = ({ item }: { item: ChatConversation }) => {
    const other = item.otherUser;
    const unread = item.unreadCount || 0;
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openChat(item)}
        activeOpacity={0.8}
      >
        {other?.avatar ? (
          <Image source={{ uri: absoluteAvatarUrl(other.avatar) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}22` }]}>
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>
              {(other?.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {other?.username || 'Conversation'}
            </Text>
            {!!item.updatedAt && (
              <Text style={[styles.time, { color: colors.textDim }]}>
                {timeAgo(item.updatedAt)}
              </Text>
            )}
          </View>
          <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={1}>
            {item.lastMessage?.isDeleted
              ? 'Message deleted'
              : item.lastMessage?.content || 'Say hello 👋'}
          </Text>
        </View>
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Messages" emoji="💬" subtitle="Your direct chats" />

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textDim }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Search people to message"
          placeholderTextColor={colors.textDim}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => navigation.navigate('DiscoverPeople')}
          accessibilityLabel="Find people to message"
        >
          <Text style={styles.quickBtnPrimaryText}>Find people to message</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { borderColor: colors.border }]}
          onPress={() => navigation.navigate('DiscoverPeople')}
          accessibilityLabel="Say hi"
        >
          <Text style={[styles.quickBtnText, { color: colors.textMuted }]}>Say hi 👋</Text>
        </TouchableOpacity>
      </View>

      {query.trim().length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          ListEmptyComponent={
            !searching ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No people found</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => startChat(item)}
              activeOpacity={0.8}
            >
              {item.avatar ? (
                <Image source={{ uri: absoluteAvatarUrl(item.avatar) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}22` }]}>
                  <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.name, { color: colors.text, flex: 1 }]}>{item.username}</Text>
              <Text style={[styles.startText, { color: colors.primary }]}>Message →</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={[styles.empty, { color: colors.text }]}>No messages yet</Text>
                <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                  Search for a friend above to start chatting.
                </Text>
              </View>
            )
          }
          renderItem={renderRow}
        />
      )}

      {!!error && (
        <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  quickBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  quickBtnPrimaryText: { color: '#0a0a0f', fontSize: 10, fontWeight: '900' },
  quickBtnText: { fontSize: 10, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '900' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: fontSize.sm, fontWeight: '800', flexShrink: 1 },
  time: { fontSize: 10, fontWeight: '600' },
  preview: { fontSize: fontSize.xs, marginTop: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#0a0a0f', fontSize: 10, fontWeight: '900' },
  startText: { fontSize: fontSize.xs, fontWeight: '800' },
  emptyBox: { alignItems: 'center', marginTop: spacing.xxl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  empty: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  emptySub: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg },
  error: { fontSize: fontSize.xs, textAlign: 'center', paddingBottom: spacing.sm },
});
