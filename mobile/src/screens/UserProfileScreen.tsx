import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api } from '../services/api';
import { absoluteAvatarUrl, formatCount, formatDate, timeAgo } from '../utils/helpers';

interface PublicProfile {
  userId: string;
  username: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  signature: string | null;
  themeColor: string | null;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  friendsCount: number;
  level: number;
  points: number;
  stats: {
    total: number;
    completed: number;
    current: number;
    planning: number;
    episodesWatched: number;
    meanScore: number;
  };
  activities: {
    id: string;
    type: string;
    mediaTitle: string | null;
    mediaImage: string | null;
    message: string | null;
    createdAt: string;
  }[];
  isSelf: boolean;
  isFollowing: boolean;
  friendStatus?: { status?: string; requestId?: string } | null;
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const username: string = route.params?.username || '';

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.users.publicProfile(username);
      setProfile(data);
    } catch (e: any) {
      setError(e?.message || 'Could not load this profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const follow = async () => {
    if (!profile || busy) return;
    setBusy(true);
    const next = !profile.isFollowing;
    setProfile({ ...profile, isFollowing: next });
    try {
      await api.follow(profile.userId, next);
    } catch (e: any) {
      setProfile((p) => (p ? { ...p, isFollowing: !next } : p));
      Alert.alert('Could not update follow', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const friendAction = async () => {
    if (!profile || busy) return;
    const status = profile.friendStatus?.status;
    setBusy(true);
    try {
      if (status === 'pending-received' && profile.friendStatus?.requestId) {
        await api.friends.respond(profile.friendStatus.requestId, true);
      } else if (status === 'pending-sent') {
        await api.friends.remove(profile.userId);
      } else {
        await api.friends.request(profile.userId);
      }
      await load();
    } catch (e: any) {
      Alert.alert('Could not update friendship', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const message = () => {
    if (!profile) return;
    navigation.navigate('Chat', {
      userId: profile.userId,
      username: profile.username,
      avatar: profile.avatar || undefined,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={username || 'Profile'} emoji="👤" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={username || 'Profile'} emoji="👤" />
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🙈</Text>
          <Text style={[styles.empty, { color: colors.text }]}>{error || 'Profile not found'}</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={load}
          >
            <Text style={styles.primaryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const friendStatus = profile.friendStatus?.status;
  const friendLabel =
    friendStatus === 'friends'
      ? 'Friends ✓'
      : friendStatus === 'pending-received'
        ? 'Accept request'
        : friendStatus === 'pending-sent'
          ? 'Request sent'
          : '+ Add friend';

  const stats = [
    { label: 'Anime', value: formatCount(profile.stats.total) },
    { label: 'Completed', value: formatCount(profile.stats.completed) },
    { label: 'Episodes', value: formatCount(profile.stats.episodesWatched) },
    { label: 'Mean', value: profile.stats.meanScore || '--' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={profile.username} emoji="👤" subtitle={`Level ${profile.level}`} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingTop: spacing.lg },
          ]}
        >
          {!!profile.banner && (
            <Image
              source={{ uri: absoluteAvatarUrl(profile.banner) }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.identity}>
            <View style={[styles.avatarWrap, { borderColor: colors.primary }]}>
              {profile.avatar ? (
                <Image source={{ uri: absoluteAvatarUrl(profile.avatar) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: `${colors.primary}22` }]}>
                  <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                    {profile.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.username, { color: colors.text }]}>{profile.username}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Level {profile.level} · {formatCount(profile.points)} pts
              </Text>
              <Text style={[styles.meta, { color: colors.textDim }]}>
                Joined {formatDate(profile.createdAt)}
              </Text>
            </View>
          </View>

          {!!profile.bio && (
            <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text>
          )}

          <View style={styles.socialRow}>
            {[
              { label: 'Followers', value: profile.followersCount },
              { label: 'Following', value: profile.followingCount },
              { label: 'Friends', value: profile.friendsCount },
            ].map((s) => (
              <View key={s.label} style={styles.socialItem}>
                <Text style={[styles.socialValue, { color: colors.text }]}>{formatCount(s.value)}</Text>
                <Text style={[styles.socialLabel, { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {!profile.isSelf && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={follow}
                disabled={busy}
              >
                <Text style={styles.primaryText}>
                  {profile.isFollowing ? 'Following ✓' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: colors.primary, flex: 1 }]}
                onPress={friendAction}
                disabled={busy || friendStatus === 'pending-sent' || friendStatus === 'friends'}
              >
                <Text style={[styles.outlineText, { color: colors.primary }]}>{friendLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: `${colors.primary}1f` }]}
                onPress={message}
              >
                <Text style={{ color: colors.primary, fontSize: 16 }}>💬</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <FadeInView delay={60} style={styles.statsGrid}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </FadeInView>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent activity</Text>
        {profile.activities.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No public activity yet.</Text>
        ) : (
          profile.activities.map((a) => (
            <View
              key={a.id}
              style={[styles.activityRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {a.mediaImage ? (
                <Image source={{ uri: a.mediaImage }} style={styles.activityImage} />
              ) : (
                <View style={[styles.activityImage, styles.avatarFallback, { backgroundColor: `${colors.primary}22` }]}>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>★</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={2}>
                  {a.message || a.mediaTitle || a.type.replace(/_/g, ' ')}
                </Text>
                <Text style={[styles.activityMeta, { color: colors.textDim }]}>
                  {timeAgo(a.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    borderBottomWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  bannerImage: { height: 96, borderRadius: borderRadius.md, marginBottom: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarWrap: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, overflow: 'hidden' },
  avatar: { width: 66, height: 66, borderRadius: 33 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 26, fontWeight: '900' },
  username: { fontSize: fontSize.xl, fontWeight: '900' },
  meta: { fontSize: fontSize.xs, marginTop: 2 },
  bio: { fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.md },
  socialRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  socialItem: { flex: 1, alignItems: 'center' },
  socialValue: { fontSize: fontSize.md, fontWeight: '900' },
  socialLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  primaryBtn: { borderRadius: borderRadius.md, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  primaryText: { color: '#0a0a0f', fontSize: fontSize.sm, fontWeight: '900' },
  outlineBtn: { borderRadius: borderRadius.md, paddingVertical: spacing.sm + 2, alignItems: 'center', borderWidth: 1 },
  outlineText: { fontSize: fontSize.sm, fontWeight: '800' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  statCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: fontSize.lg, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  activityImage: { width: 44, height: 56, borderRadius: 8 },
  activityTitle: { fontSize: fontSize.sm, fontWeight: '600' },
  activityMeta: { fontSize: 10, marginTop: 3 },
  emptyBox: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  empty: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.sm },
});
