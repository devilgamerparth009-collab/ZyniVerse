import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api, ChatUserRef, FriendRequestRow } from '../services/api';
import { absoluteAvatarUrl } from '../utils/helpers';

type Tab = 'friends' | 'pending' | 'sent';
const TABS: { key: Tab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'pending', label: 'Requests' },
  { key: 'sent', label: 'Sent' },
];

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<ChatUserRef[]>([]);
  const [pending, setPending] = useState<FriendRequestRow[]>([]);
  const [sent, setSent] = useState<FriendRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [f, p, s] = await Promise.all([
        api.friends.list('friends').catch(() => ({ friends: [] })),
        api.friends.list('pending').catch(() => ({ requests: [] })),
        api.friends.list('sent').catch(() => ({ requests: [] })),
      ]);
      setFriends(f?.friends || []);
      setPending(p?.requests || []);
      setSent(s?.requests || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load friends');
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

  const respond = async (request: FriendRequestRow, accept: boolean) => {
    setBusy(request.id);
    try {
      await api.friends.respond(request.id, accept);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update request', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = (friend: ChatUserRef) => {
    Alert.alert('Remove friend', `Remove ${friend.username} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(friend.id);
          try {
            await api.friends.remove(friend.id);
            await load();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message || 'Please try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const openChat = (user: ChatUserRef) => {
    navigation.navigate('Chat', {
      userId: user.id,
      username: user.username,
      avatar: user.avatar || undefined,
    });
  };

  const Avatar = ({ user, size = 46 }: { user?: ChatUserRef | null; size?: number }) => {
    if (user?.avatar) {
      return <Image source={{ uri: absoluteAvatarUrl(user.avatar) }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    }
    return (
      <View
        style={[
          styles.avatarFallback,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: `${colors.primary}22` },
        ]}
      >
        <Text style={[styles.avatarLetter, { color: colors.primary }]}>
          {(user?.username || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  const renderFriend = ({ item }: { item: ChatUserRef }) => (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.identity}
        onPress={() => navigation.navigate('UserProfile', { username: item.username })}
        activeOpacity={0.8}
      >
        <Avatar user={item} />
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.username}
        </Text>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: `${colors.primary}1f` }]}
          onPress={() => openChat(item)}
        >
          <Text style={[styles.smallBtnText, { color: colors.primary }]}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: `${colors.border}` }]}
          onPress={() => remove(item)}
          disabled={busy === item.id}
        >
          <Text style={[styles.smallBtnText, { color: colors.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRequest = ({ item }: { item: FriendRequestRow }) => {
    const user = item.sender || item.receiver;
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.identity}
          onPress={() => user && navigation.navigate('UserProfile', { username: user.username })}
          activeOpacity={0.8}
        >
          <Avatar user={user} />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {user?.username || 'User'}
          </Text>
        </TouchableOpacity>
        {tab === 'pending' ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.pillBtn, { backgroundColor: colors.primary }]}
              onPress={() => respond(item, true)}
              disabled={busy === item.id}
            >
              {busy === item.id ? (
                <ActivityIndicator size="small" color="#0a0a0f" />
              ) : (
                <Text style={styles.pillText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtnOutline, { borderColor: colors.border }]}
              onPress={() => respond(item, false)}
              disabled={busy === item.id}
            >
              <Text style={[styles.pillTextOutline, { color: colors.textMuted }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.pillBtnOutline, { borderColor: colors.border }]}
            onPress={() => {
              if (user) api.friends.remove(user.id).then(load).catch(() => {});
            }}
          >
            <Text style={[styles.pillTextOutline, { color: colors.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const data = tab === 'friends' ? friends : tab === 'pending' ? pending : sent;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Friends" emoji="🤝" subtitle="Your anime circle" />

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = t.key === 'friends' ? friends.length : t.key === 'pending' ? pending.length : sent.length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
                { borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, { color: active ? '#0a0a0f' : colors.textMuted }]}>
                {t.label}
                {count > 0 ? ` · ${count}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={data as any[]}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>{tab === 'friends' ? '🤝' : '📨'}</Text>
              <Text style={[styles.empty, { color: colors.text }]}>
                {tab === 'friends'
                  ? 'No friends yet'
                  : tab === 'pending'
                    ? 'No pending requests'
                    : 'No sent requests'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {tab === 'friends'
                  ? 'Open someone’s profile and send a friend request.'
                  : 'New requests will appear here.'}
              </Text>
            </View>
          }
          renderItem={tab === 'friends' ? (renderFriend as any) : (renderRequest as any)}
        />
      )}

      {!!error && <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1 },
  tabText: { fontSize: 11, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '900' },
  name: { fontSize: fontSize.sm, fontWeight: '800', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: 14, fontWeight: '800' },
  pillBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.full },
  pillText: { fontSize: 11, fontWeight: '900', color: '#0a0a0f' },
  pillBtnOutline: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1 },
  pillTextOutline: { fontSize: 11, fontWeight: '800' },
  emptyBox: { alignItems: 'center', marginTop: spacing.xxl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  empty: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg },
  error: { fontSize: fontSize.xs, textAlign: 'center', paddingBottom: spacing.sm },
});
