import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { getCurrentUser, api } from '../services/api';
import {
  Anime,
  ProfileAchievement,
  ProfileEntry,
  ProfileResponse,
  ReviewItem,
} from '../types';
import {
  absoluteAvatarUrl,
  formatCount,
  formatDate,
  getStatusColorForCode,
  LIST_STATUS_LABEL,
  timeAgo,
} from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';

type TabKey = 'lists' | 'stats' | 'achievements' | 'activity';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'lists', label: 'Lists' },
  { key: 'stats', label: 'Stats' },
  { key: 'achievements', label: 'Badges' },
  { key: 'activity', label: 'Activity' },
];

const STATUS_FILTERS = ['ALL', 'CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED'];

async function mediaMapFor(entries: ProfileEntry[]): Promise<Map<number, Anime>> {
  const ids = [...new Set(entries.map((e) => e.mediaId))];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const results = await Promise.all(chunks.map((c) => api.batch(c).catch(() => [] as Anime[])));
  return new Map(results.flat().map((m) => [m.id, m]));
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali } = useTheme();
  const primaryAccent = isDiwali ? '#f59e0b' : colors.primary;

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [mediaMap, setMediaMap] = useState<Map<number, Anime>>(new Map());
  const [loggedIn, setLoggedIn] = useState(true);
  const [tab, setTab] = useState<TabKey>('lists');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks which avatar URL failed so we can fall back to the initial. Using the
  // URL (not a boolean) means a newly saved picture retries automatically.
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [failedAvatarAt, setFailedAvatarAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const user = await getCurrentUser();
      setLoggedIn(!!user);
      if (!user) {
        setProfile(null);
        return;
      }
      const data = await api.profile.get();
      setProfile(data);
      const map = await mediaMapFor(data.user.entries);
      setMediaMap(map);
    } catch (e: any) {
      setError(e?.message || 'Could not load your profile');
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

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await api.auth.logout();
          setProfile(null);
          setLoggedIn(false);
        },
      },
    ]);
  };

  const filteredEntries = useMemo(() => {
    if (!profile) return [];
    if (statusFilter === 'ALL') return profile.user.entries;
    return profile.user.entries.filter((e) => e.status === statusFilter);
  }, [profile, statusFilter]);

  const topAnime = useMemo(() => {
    if (!profile) return [];
    return profile.topAnime
      .map((t) => ({ ...t, anime: mediaMap.get(t.mediaId) }))
      .filter((t) => !!t.anime);
  }, [profile, mediaMap]);

  if (loading) return <LoadingSpinner fullScreen />;

  // A stale session shows up as "Unauthorized" / 401 from /api/profile even
  // though a cached user was returned locally. Treat that as signed-out instead
  // of dead-ending on an error screen.
  const needsSignIn = !loggedIn || (!!error && /unauthor|401|session|sign in|expired/i.test(error));

  if (needsSignIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.authCenter}>
          <Text style={styles.authIcon}>👤</Text>
          <Text style={[styles.authTitle, { color: colors.text }]}>Your anime universe awaits</Text>
          <Text style={[styles.authSubtitle, { color: colors.textMuted }]}>
            Sign in to build lists, track episodes, earn badges, and see your stats.
          </Text>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: primaryAccent }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.authButtonText}>Sign In / Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={[styles.authSettings, { color: colors.textDim }]}>App Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error && !profile) {
    return <ErrorView message={error} onRetry={load} />;
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.authCenter}>
          <Text style={styles.authIcon}>📡</Text>
          <Text style={[styles.authTitle, { color: colors.text }]}>Profile unavailable</Text>
          <Text style={[styles.authSubtitle, { color: colors.textMuted }]}>
            We could not reach your profile. Check your connection and try again.
          </Text>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: primaryAccent }]}
            onPress={load}
          >
            <Text style={styles.authButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={[styles.authSettings, { color: colors.textDim }]}>App Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { user, stats } = profile;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.banner, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Messages')}
              accessibilityLabel="Messages"
            >
              <Text style={styles.iconText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Friends')}
              accessibilityLabel="Friends"
            >
              <Text style={styles.iconText}>👥</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() =>
                navigation.navigate('UserProfile', { username: user.username })
              }
              accessibilityLabel="Public profile"
            >
              <Text style={styles.iconText}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Settings"
            >
              <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>
          </View>

          <FadeInView duration={380}>
            <View style={styles.identity}>
              <View style={[styles.avatarWrap, { backgroundColor: colors.surfaceLight, borderColor: colors.primary, borderWidth: 2 }]}>
                {user.avatar && user.avatar !== failedAvatar && user !== null ? (
                  <Image
                    source={{ uri: absoluteAvatarUrl(user.avatar) }}
                    style={styles.avatar}
                    onError={() => {
                      if (user.avatar !== failedAvatar) {
                        setFailedAvatar(user.avatar || null);
                        setFailedAvatarAt(Date.now());
                      }
                    }}
                  />
                ) : (
                  <View style={[styles.avatarWrap, { backgroundColor: colors.surfaceLight, borderColor: colors.primary, borderWidth: 2 }]}>
                    <Text style={[styles.avatarLetter, { color: colors.primary, fontWeight: '900', fontSize: 24 }]}>
                      {(user.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.username}>{user.username}</Text>
                <Text style={styles.levelLine}>
                  Level {user.level} · {formatCount(user.points)} pts
                </Text>
                <Text style={styles.joinLine}>Joined {formatDate(user.createdAt)}</Text>
              </View>
            </View>
          </FadeInView>

          {user.bio ? (
            <FadeInView delay={60}>
              <Text style={styles.bio}>{user.bio}</Text>
            </FadeInView>
          ) : null}

          <FadeInView delay={100} style={styles.socialRow}>
            <View style={styles.socialItem}>
              <Text style={styles.socialValue}>{formatCount(user.followersCount)}</Text>
              <Text style={styles.socialLabel}>Followers</Text>
            </View>
            <View style={styles.socialItem}>
              <Text style={styles.socialValue}>{formatCount(user.followingCount)}</Text>
              <Text style={styles.socialLabel}>Following</Text>
            </View>
            <View style={styles.socialItem}>
              <Text style={styles.socialValue}>{formatCount(stats.episodesWatched)}</Text>
              <Text style={styles.socialLabel}>Episodes</Text>
            </View>
            <View style={styles.socialItem}>
              <Text style={styles.socialValue}>{stats.meanScore || '--'}</Text>
              <Text style={styles.socialLabel}>Mean Score</Text>
            </View>
          </FadeInView>

          <FadeInView delay={150} style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </FadeInView>
        </View>

        <FadeInView delay={190} style={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </FadeInView>

        {tab === 'lists' && (
          <FadeInView key="lists" style={styles.tabBody} offset={10} duration={320}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {STATUS_FILTERS.map((status) => {
                const active = statusFilter === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {status === 'ALL' ? 'All' : LIST_STATUS_LABEL[status]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredEntries.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyText}>Nothing here yet</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => navigation.navigate('Search')}
                >
                  <Text style={styles.emptyButtonText}>Find Anime</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredEntries.map((entry, index) => {
                const anime = mediaMap.get(entry.mediaId);
                const title =
                  anime?.title?.english ||
                  anime?.title?.romaji ||
                  `Anime #${entry.mediaId}`;
                const poster =
                  anime?.coverImage?.large ||
                  anime?.coverImage?.medium ||
                  anime?.coverImage?.extraLarge;
                const pct =
                  entry.total > 0 ? Math.min(100, (entry.progress / entry.total) * 100) : 0;
                return (
                  <FadeInView
                    key={`${entry.mediaId}-${entry.type}`}
                    delay={Math.min(index * 40, 320)}
                    duration={320}
                    offset={10}
                  >
                  <TouchableOpacity
                    style={styles.listRow}
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate('AnimeDetail', { id: entry.mediaId, title })
                    }
                  >
                    {poster ? (
                      <Image source={{ uri: poster }} style={styles.listPoster} />
                    ) : (
                      <View style={[styles.listPoster, styles.listPosterPlaceholder]}>
                        <Text style={styles.placeholderText}>?</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text style={styles.listMeta}>
                        {entry.progress}
                        {entry.total ? ` / ${entry.total}` : ''} eps
                        {entry.score ? ` · ★ ${entry.score}` : ''}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${pct}%`, backgroundColor: getStatusColorForCode(entry.status) },
                          ]}
                        />
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { borderColor: getStatusColorForCode(entry.status) },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: getStatusColorForCode(entry.status) }]}
                      >
                        {LIST_STATUS_LABEL[entry.status] || entry.status}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  </FadeInView>
                );
              })
            )}
          </FadeInView>
        )}

        {tab === 'stats' && (
          <FadeInView key="stats" style={styles.tabBody} offset={10} duration={320}>
            <View style={styles.statsGrid}>
              {[
                { label: 'Total', value: stats.total, color: colors.text },
                { label: 'Watching', value: stats.current, color: colors.watching },
                { label: 'Completed', value: stats.completed, color: colors.completed },
                { label: 'Planning', value: stats.planning, color: colors.planning },
                { label: 'Paused', value: stats.paused, color: colors.paused },
                { label: 'Dropped', value: stats.dropped, color: colors.dropped },
              ].map((s, index) => (
                <FadeInView key={s.label} delay={Math.min(index * 35, 210)} duration={300} offset={8}>
                  <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                </FadeInView>
              ))}
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Episodes watched</Text>
              <Text style={styles.highlightValue}>{formatCount(stats.episodesWatched)}</Text>
              <Text style={styles.highlightSub}>
                That is about{' '}
                {Math.round((stats.episodesWatched * 24) / 60 / 24)} days of anime.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Top Rated</Text>
            {topAnime.length === 0 ? (
              <Text style={styles.mutedText}>
                Rate some completed anime to build your top 5.
              </Text>
            ) : (
              topAnime.map((item, index) => (
                <TouchableOpacity
                  key={item.mediaId}
                  style={styles.topRow}
                  onPress={() =>
                    navigation.navigate('AnimeDetail', {
                      id: item.mediaId,
                      title: item.anime?.title?.english || item.anime?.title?.romaji,
                    })
                  }
                >
                  <Text style={styles.topRank}>#{index + 1}</Text>
                  {item.anime?.coverImage?.medium ? (
                    <Image
                      source={{ uri: item.anime.coverImage.medium }}
                      style={styles.topPoster}
                    />
                  ) : (
                    <View style={[styles.topPoster, styles.listPosterPlaceholder]} />
                  )}
                  <Text style={styles.topTitle} numberOfLines={2}>
                    {item.anime?.title?.english || item.anime?.title?.romaji}
                  </Text>
                  <Text style={styles.topScore}>★ {item.score}</Text>
                </TouchableOpacity>
              ))
            )}
          </FadeInView>
        )}

        {tab === 'achievements' && (
          <FadeInView key="achievements" style={styles.tabBody} offset={10} duration={320}>
            <Text style={styles.sectionTitle}>Earned Badges</Text>
            {user.achievements.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🏅</Text>
                <Text style={styles.emptyText}>No badges yet</Text>
                <Text style={styles.emptyHint}>
                  Watch anime, write reviews, and post in the forum to earn them.
                </Text>
              </View>
            ) : (
              <View style={styles.badgeGrid}>
                {user.achievements.map((a: ProfileAchievement) => (
                  <View key={a.code} style={styles.badgeCard}>
                    <Text style={styles.badgeIcon}>{a.icon || ''}</Text>
                    <Text style={styles.badgeName} numberOfLines={2}>
                      {a.name}
                    </Text>
                    <Text style={styles.badgePoints}>+{a.points} pts</Text>
                    <Text style={styles.badgeDate}>{formatDate(a.earnedAt)}</Text>
                  </View>
                ))}
              </View>
            )}

            {user.reviews.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Your Reviews</Text>
                {user.reviews.slice(0, 5).map((review: ReviewItem) => (
                  <TouchableOpacity
                    key={review.id}
                    style={styles.reviewCard}
                    onPress={() =>
                      navigation.navigate('AnimeDetail', { id: review.mediaId })
                    }
                  >
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewScore}>★ {review.rating}/10</Text>
                      <Text style={styles.reviewTime}>{timeAgo(review.createdAt)}</Text>
                    </View>
                    {review.comment ? (
                      <Text style={styles.reviewText} numberOfLines={3}>
                        {review.comment}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </FadeInView>
        )}

        {tab === 'activity' && (
          <FadeInView key="activity" style={styles.tabBody} offset={10} duration={320}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {user.recentActivity.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🕒</Text>
                <Text style={styles.emptyText}>No activity yet</Text>
                <Text style={styles.emptyHint}>Start watching or rating anime to see it here.</Text>
              </View>
            ) : (
              user.recentActivity.map((activity) => (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.activityRow}
                  activeOpacity={activity.mediaId ? 0.8 : 1}
                  onPress={() => {
                    if (activity.mediaId) {
                      navigation.navigate('AnimeDetail', {
                        id: activity.mediaId,
                        title: activity.mediaTitle || undefined,
                      });
                    }
                  }}
                >
                  {activity.mediaImage ? (
                    <Image source={{ uri: activity.mediaImage }} style={styles.activityImage} />
                  ) : (
                    <View style={[styles.activityImage, styles.listPosterPlaceholder]}>
                      <Text style={styles.placeholderText}></Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle} numberOfLines={2}>
                      {activity.mediaTitle || activity.message || activity.type}
                    </Text>
                    {activity.message && activity.mediaTitle ? (
                      <Text style={styles.activityMessage} numberOfLines={2}>
                        {activity.message}
                      </Text>
                    ) : null}
                    <Text style={styles.activityTime}>{timeAgo(activity.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </FadeInView>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  bannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.text,
    fontSize: 16,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    color: colors.primary,
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  username: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  levelLine: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  joinLine: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  bio: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  socialRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  socialItem: {
    flex: 1,
    alignItems: 'center',
  },
  socialValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  socialLabel: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  signOutButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#0a0a0f',
  },
  tabBody: {
    padding: spacing.md,
  },
  filterScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  listPoster: {
    width: 46,
    height: 64,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
  },
  listPosterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textDim,
    fontSize: fontSize.md,
  },
  listTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  listMeta: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceLight,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusPill: {
    marginLeft: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  highlightCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
  },
  highlightLabel: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightValue: {
    color: colors.text,
    fontSize: fontSize.hero,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  highlightSub: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  mutedText: {
    color: colors.textDim,
    fontSize: fontSize.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  topRank: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '800',
    width: 32,
  },
  topPoster: {
    width: 34,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
  },
  topTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  topScore: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  badgeIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  badgeName: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  badgePoints: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeDate: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  reviewCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  reviewScore: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  reviewTime: {
    color: colors.textDim,
    fontSize: fontSize.xs,
  },
  reviewText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  activityImage: {
    width: 40,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
  },
  activityTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  activityMessage: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  activityTime: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  emptyHint: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  authCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  authIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  authTitle: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  authSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  authButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  authButtonText: {
    color: '#0a0a0f',
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  authSettings: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    marginTop: spacing.lg,
  },
}));
