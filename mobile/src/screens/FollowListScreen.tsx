import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PillButton,
  SignedOutCard,
  SocialAvatar,
} from '../components/social/SocialBits';
import { useSocialAuth } from '../hooks/useSocialAuth';
import { useTheme } from '../hooks/useTheme';
import type { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { PublicUser } from '../types/social';
import { spacing, fontSize, borderRadius } from '../theme';

type FollowRoute = RouteProp<RootStackParamList, 'FollowList'>;

export default function FollowListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<FollowRoute>();
  const { userId, mode } = route.params;
  const { colors } = useTheme();
  const { checking, signedIn } = useSocialAuth();

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [listResult, me] = await Promise.all([
        api.followLists.list(userId, mode, 50).catch((e: unknown) => Promise.reject(e)),
        api.auth.current().catch(() => null),
      ]);
      setUsers(listResult.users);
      setNextCursor(listResult.nextCursor);
      setMeId(me?.id || null);

      // The list only returns public user rows, so your own following list is
      // used to decide who needs a "Follow back" button.
      let ownFollowing: PublicUser[] = [];
      if (me?.id) {
        if (me.id === userId && mode === 'following') {
          ownFollowing = listResult.users;
        } else {
          const own = await api.followLists.list(me.id, 'following', 100).catch(() => null);
          ownFollowing = own?.users || [];
        }
      }
      setFollowingIds(ownFollowing.map((u) => u.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load this list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, mode]);

  useEffect(() => {
    if (!checking && signedIn) void load();
  }, [checking, signedIn, load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.followLists.list(userId, mode, 50, nextCursor);
      setUsers((list) => [...list, ...page.users.filter((u) => !list.some((x) => x.id === u.id))]);
      setNextCursor(page.nextCursor);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load more people');
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async (user: PublicUser) => {
    if (busyIds.includes(user.id)) return;
    const isFollowing = followingIds.includes(user.id);
    const next = !isFollowing;
    setBusyIds((ids) => [...ids, user.id]);
    setFollowingIds((ids) => (next ? [...ids, user.id] : ids.filter((id) => id !== user.id)));
    try {
      await api.follow(user.id, next);
    } catch (e: unknown) {
      setFollowingIds((ids) => (next ? ids.filter((id) => id !== user.id) : [...ids, user.id]));
      setError(e instanceof Error ? e.message : 'Could not update follow');
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== user.id));
    }
  };

  const isFollowers = mode === 'followers';

  const renderRow = ({ item }: { item: PublicUser }) => {
    const isFollowing = followingIds.includes(item.id);
    const label = isFollowing
      ? 'Unfollow'
      : isFollowers
        ? 'Follow back'
        : 'Follow';
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.identity}
          onPress={() => navigation.navigate('UserProfile', { username: item.username })}
          activeOpacity={0.8}
        >
          <SocialAvatar name={item.username} uri={item.avatar} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.username}
            </Text>
            {!!item.bio && (
              <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={1}>
                {item.bio}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {item.id !== meId && (
          <PillButton
            label={label}
            variant={isFollowing ? 'outline' : 'primary'}
            busy={busyIds.includes(item.id)}
            small
            onPress={() => toggleFollow(item)}
          />
        )}
      </View>
    );
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={isFollowers ? 'Followers' : 'Following'} emoji="🤝" />
        <LoadingBlock label="Checking your session…" />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={isFollowers ? 'Followers' : 'Following'} emoji="🤝" />
        <SignedOutCard message="Sign in to see followers and follow people back." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={isFollowers ? 'Followers' : 'Following'}
        emoji="🤝"
        subtitle={isFollowers ? 'People following this profile' : 'People this profile follows'}
      />

      {loading ? (
        <LoadingBlock label="Loading people…" />
      ) : error && users.length === 0 ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <>
          {!!error && <Text style={[styles.inlineError, { color: colors.error }]}>{error}</Text>}
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load();
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyBlock
                emoji="🤝"
                title={isFollowers ? 'No followers yet' : 'Not following anyone yet'}
                message="When people connect here, they will show up in this list."
              />
            }
            ListFooterComponent={
              nextCursor ? (
                <TouchableOpacity
                  style={[styles.moreBtn, { borderColor: colors.border }]}
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                >
                  <Text style={[styles.moreText, { color: colors.primary }]}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inlineError: { fontSize: fontSize.xs, textAlign: 'center', paddingTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  name: { fontSize: fontSize.sm, fontWeight: '800' },
  bio: { fontSize: fontSize.xs, marginTop: 2 },
  moreBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingVertical: 10, alignItems: 'center' },
  moreText: { fontSize: fontSize.sm, fontWeight: '800' },
});
