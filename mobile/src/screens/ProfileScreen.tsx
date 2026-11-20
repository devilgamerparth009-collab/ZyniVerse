import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
  formatCount,
  formatDate,
  getStatusColorForCode,
  LIST_STATUS_LABEL,
  timeAgo,
} from '../utils/helpers';
import { openSafeWebUrl } from '../utils/safeLinks';
import LoadingSpinner from '../components/LoadingSpinner';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import ProfileAvatar from '../components/profile/ProfileAvatar';
import ProfileThumb from '../components/profile/ProfileThumb';

type TabKey = 'lists' | 'stats' | 'achievements' | 'activity' | 'reviews' | 'more';
type SessionIssue = 'none' | 'expired' | 'error';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'lists', label: 'Lists' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'stats', label: 'Stats' },
  { key: 'achievements', label: 'Badges' },
  { key: 'activity', label: 'Activity' },
  { key: 'more', label: 'More' },
];

const PROFILE_COLORS = ['emerald', 'violet', 'amber', 'rose', 'cyan'];

function openWeb(path: string) {
  openSafeWebUrl(path, '/');
}

const STATUS_FILTERS = ['ALL', 'CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED'];

/** Personal features that pair naturally with your profile and lists. */
const EXPLORE_ITEMS: {
  key: string;
  icon: string;
  label: string;
  sub: string;
  tint: string;
  route: string;
  params?: Record<string, any>;
}[] = [
  { key: 'recommendations', icon: '✨', label: 'Recommendations', sub: 'Picks based on your list', tint: '#a855f7', route: 'Recommendations' },
  { key: 'taste', icon: '🧬', label: 'Taste Profile', sub: 'See what anime fits you', tint: '#22d3ee', route: 'TasteProfile' },
  { key: 'watchlist', icon: '📌', label: 'Watchlist', sub: 'Plan what to watch next', tint: '#f43f5e', route: 'Hub', params: { kind: 'watchlist', title: 'Watchlist' } },
  { key: 'discover', icon: '🧭', label: 'Discover people', sub: 'Find fans with similar taste', tint: '#22c55e', route: 'DiscoverPeople' },
  { key: 'channels', icon: '📣', label: 'Broadcast channels', sub: 'Follow creator updates', tint: '#f59e0b', route: 'Channels' },
  { key: 'stories', icon: '✨', label: 'Stories', sub: 'Watch daily moments', tint: '#f472b6', route: 'Stories' },
];

function isSessionError(message?: string | null): boolean {
  return !!message && /unauthor|401|403|session|sign in|expired|logged in/i.test(message);
}

function AuthState({
  icon,
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
}: {
  icon: string;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tertiaryLabel?: string;
  onTertiary?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const primaryAccent = isLaunch ? '#22d3ee' : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.authCenter}>
        <Text style={styles.authIcon}>{icon}</Text>
        <Text style={[styles.authTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.authSubtitle, { color: colors.textMuted }]}>{message}</Text>
        <TouchableOpacity
          style={[styles.authButton, { backgroundColor: primaryAccent }]}
          onPress={onPrimary}
        >
          <Text style={styles.authButtonText}>{primaryLabel}</Text>
        </TouchableOpacity>
        {secondaryLabel && onSecondary ? (
          <TouchableOpacity onPress={onSecondary}>
            <Text style={[styles.authSettings, { color: colors.textDim }]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
        {tertiaryLabel && onTertiary ? (
          <TouchableOpacity onPress={onTertiary}>
            <Text style={[styles.authSettings, styles.authTertiary, { color: colors.textDim }]}>
              {tertiaryLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

async function mediaMapFor(entries: ProfileEntry[]): Promise<Map<number, Anime>> {
  const ids = [...new Set(entries.map((e) => e.mediaId))];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const results = await Promise.all(chunks.map((c) => api.batch(c).catch(() => [] as Anime[])));
  return new Map(results.flat().map((m) => [m.id, m]));
}

/** One place for every website profile/account option that exists in the APK. */
function MoreTab({
  profile,
  onChanged,
}: {
  profile: ProfileResponse;
  onChanged: () => void;
}) {
  const navigation = useNavigation<any>();
  const { user } = profile;
  const [lists, setLists] = useState<any[]>([]);
  const [moments, setMoments] = useState<any[]>([]);
  const [economy, setEconomy] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [customLists, userMoments, wallet] = await Promise.allSettled([
        api.account.customLists(user.id),
        api.account.moments(user.id),
        api.account.economy(),
      ]);
      if (!active) return;
      if (customLists.status === 'fulfilled') setLists(customLists.value);
      if (userMoments.status === 'fulfilled') setMoments(userMoments.value);
      if (wallet.status === 'fulfilled') setEconomy(wallet.value);
    })();
    return () => {
      active = false;
    };
  }, [user.id]);

  const changeColor = async () => {
    const current = PROFILE_COLORS.indexOf(user.themeColor || 'emerald');
    const next = PROFILE_COLORS[(current + 1) % PROFILE_COLORS.length];
    setBusy(true);
    try {
      await api.profile.update({ themeColor: next });
      onChanged();
    } catch (e: any) {
      Alert.alert('Could not save color', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const claimDaily = async () => {
    setBusy(true);
    try {
      const result = await api.account.claimDaily();
      Alert.alert(
        'Daily reward',
        result?.message || `Claimed ${result?.coins ?? 0} coins and ${result?.xp ?? 0} XP. Streak: ${result?.streak ?? 1} day(s).`
      );
      setEconomy(await api.account.economy());
      onChanged();
    } catch (e: any) {
      Alert.alert('Could not claim', e?.message || 'Try again later.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your lists, reviews, moments and progress. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.account.delete();
              await api.auth.logout();
              onChanged();
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message || 'Try again.');
            }
          },
        },
      ]
    );
  };

  const recent = useMemo(
    () => [...user.entries].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).slice(0, 6),
    [user.entries]
  );

  const rows: { title: string; items: { icon: string; label: string; sub: string; onPress: () => void; tint?: string }[] }[] = [
    {
      title: 'Account',
      items: [
        { icon: '🎨', label: 'Profile color', sub: `Current: ${user.themeColor || 'emerald'} · tap to change`, onPress: changeColor },
        { icon: '🧩', label: 'All features', sub: 'Every feature in one place', onPress: () => navigation.navigate('AllFeatures') },
      ],
    },
    {
      title: 'Your content',
      items: [
        { icon: '📚', label: 'Custom lists', sub: `${lists.length} list${lists.length === 1 ? '' : 's'} · create & edit on the website`, onPress: () => openWeb('/lists') },
        { icon: '✨', label: 'Moments', sub: `${moments.length} moment${moments.length === 1 ? '' : 's'} · share anime quotes`, onPress: () => openWeb('/moments') },
        { icon: '🕘', label: 'Watch history', sub: `${recent.length} recent entries from your list`, onPress: () => openWeb('/profile?tab=history') },
        { icon: '💾', label: 'Saved items', sub: 'Things you bookmarked on the website', onPress: () => openWeb('/saved') },
      ],
    },
    {
      title: 'Data & privacy',
      items: [
        { icon: '📥', label: 'Import & API access', sub: 'Bring in your history and manage personal tokens', onPress: () => openWeb('/profile?tab=api') },
        { icon: '📤', label: 'Export data', sub: 'Download your watchlist as CSV', onPress: () => openWeb('/api/watchlist/export?format=csv') },
        { icon: '🗑️', label: 'Delete account', sub: 'Permanently remove all your data', onPress: confirmDelete, tint: colors.error },
      ],
    },
    {
      title: 'Rewards',
      items: [
        {
          icon: '🪙',
          label: 'Daily login reward',
          sub: economy?.authenticated
            ? `Wallet: ${economy.coins ?? 0} coins · ${economy.points ?? 0} pts`
            : 'Sign in to claim coins and XP',
          onPress: claimDaily,
          tint: colors.warning,
        },
        { icon: '🏆', label: 'Leaderboard', sub: 'Top fans this season', onPress: () => navigation.navigate('Leaderboard') },
        { icon: '⚔️', label: 'Challenges', sub: 'Join community challenges', onPress: () => openWeb('/challenges') },
      ],
    },
    {
      title: 'Help',
      items: [
        { icon: '📖', label: 'Docs & FAQ', sub: 'Guides and common questions', onPress: () => openWeb('/docs') },
      ],
    },
  ];

  return (
    <View style={styles.tabBody}>
      {busy ? <Text style={styles.moreBusy}>Saving…</Text> : null}
      {rows.map((section) => (
        <View key={section.title} style={styles.moreSection}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <TouchableOpacity key={item.label} style={styles.moreRow} activeOpacity={0.8} onPress={item.onPress}>
              <Text style={styles.moreIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.moreLabel, item.tint ? { color: item.tint } : undefined]}>{item.label}</Text>
                <Text style={styles.moreSub} numberOfLines={2}>{item.sub}</Text>
              </View>
              <Text style={styles.moreChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {recent.length > 0 ? (
        <View style={styles.moreSection}>
          <Text style={styles.sectionTitle}>Recently updated</Text>
          {recent.map((entry) => (
            <TouchableOpacity
              key={`${entry.mediaId}-${entry.status}`}
              style={styles.moreRow}
              onPress={() => navigation.navigate('AnimeDetail', { id: entry.mediaId })}
            >
              <Text style={styles.moreIcon}>🎬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.moreLabel}>Anime #{entry.mediaId}</Text>
                <Text style={styles.moreSub}>
                  {entry.status} · {entry.progress || 0}/{entry.total || '?'} episodes
                </Text>
              </View>
              <Text style={styles.moreChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [mediaMap, setMediaMap] = useState<Map<number, Anime>>(new Map());
  // Never trust a cached user. This only flips to true after the profile API
  // confirms the stored session is still valid.
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionIssue, setSessionIssue] = useState<SessionIssue>('none');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('lists');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const clearSession = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* storage may be unavailable; local state still resets */
    }
    setProfile(null);
    setMediaMap(new Map());
    setLoggedIn(false);
    setSessionIssue('none');
    setAuthMessage(null);
  }, []);

  const load = useCallback(async () => {
    setSessionIssue('none');
    setAuthMessage(null);
    try {
      const [hasSession, cachedUser] = await Promise.all([
        api.auth.isLoggedIn(),
        getCurrentUser(),
      ]);

      // A cached user without a stored session is stale data, not a sign-in.
      if (!hasSession) {
        if (cachedUser) await clearSession();
        setProfile(null);
        setMediaMap(new Map());
        setLoggedIn(false);
        return;
      }

      // The profile request is the verification step. Cached user details are
      // never rendered as a half-logged-in profile.
      const data = await api.profile.get();
      setProfile(data);
      setLoggedIn(true);
      const map = await mediaMapFor(data.user.entries);
      setMediaMap(map);
    } catch (e: any) {
      const message = e?.message || 'Could not load your profile';
      setProfile(null);
      setMediaMap(new Map());
      setLoggedIn(false);
      if (isSessionError(message)) {
        try {
          await api.auth.logout();
        } catch {
          /* ignore storage failures while clearing a stale session */
        }
        setSessionIssue('expired');
        setAuthMessage(
          'Your saved session was no longer valid, so we cleared it. Sign in again to continue.'
        );
      } else {
        setSessionIssue('error');
        setAuthMessage(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clearSession]);

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
          await clearSession();
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

  if (!loggedIn || !profile) {
    if (sessionIssue === 'expired') {
      return (
        <AuthState
          icon="🔒"
          title="Session expired"
          message={authMessage || 'Your saved session is no longer valid. Sign in again.'}
          primaryLabel="Sign In / Sign Up"
          onPrimary={() => navigation.navigate('Login')}
          secondaryLabel="Try Again"
          onSecondary={load}
          tertiaryLabel="Sign Out"
          onTertiary={clearSession}
        />
      );
    }
    if (sessionIssue === 'error') {
      return (
        <AuthState
          icon="📡"
          title="Profile unavailable"
          message={authMessage || 'We could not reach your profile. Check your connection.'}
          primaryLabel="Try Again"
          onPrimary={load}
          secondaryLabel="Sign Out"
          onSecondary={clearSession}
          tertiaryLabel="App Settings"
          onTertiary={() => navigation.navigate('Settings')}
        />
      );
    }
    return (
      <AuthState
        icon="👤"
        title="Your anime universe awaits"
        message="Sign in to build lists, track episodes, earn badges, and see your stats."
        primaryLabel="Sign In / Sign Up"
        onPrimary={() => navigation.navigate('Login')}
        secondaryLabel="Try Again"
        onSecondary={load}
        tertiaryLabel="App Settings"
        onTertiary={() => navigation.navigate('Settings')}
      />
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
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
            >
              <Text style={styles.iconText}>🔔</Text>
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
              <View style={styles.avatarSlot}>
                <ProfileAvatar
                  uri={user.avatar}
                  name={user.username}
                  size={64}
                  accent={colors.primary}
                />
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
            <TouchableOpacity
              style={styles.socialItem}
              onPress={() =>
                navigation.navigate('FollowList', { userId: user.id, mode: 'followers' })
              }
              accessibilityLabel="View followers"
            >
              <Text style={styles.socialValue}>{formatCount(user.followersCount)}</Text>
              <Text style={[styles.socialLabel, styles.socialLink]}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialItem}
              onPress={() =>
                navigation.navigate('FollowList', { userId: user.id, mode: 'following' })
              }
              accessibilityLabel="View following"
            >
              <Text style={styles.socialValue}>{formatCount(user.followingCount)}</Text>
              <Text style={[styles.socialLabel, styles.socialLink]}>Following</Text>
            </TouchableOpacity>
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

        {/* Explore this feature */}
        <FadeInView delay={200} style={styles.exploreSection}>
          <Text style={[styles.exploreTitle, { color: colors.primary }]}>EXPLORE THIS FEATURE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exploreRow}
          >
            {EXPLORE_ITEMS.map((item) => (
              <PressableScale
                key={item.key}
                accessibilityLabel={`Explore ${item.label}`}
                onPress={() => navigation.navigate(item.route, item.params)}
                style={[
                  styles.exploreCard,
                  { backgroundColor: colors.surface, borderColor: `${item.tint}55` },
                ]}
              >
                <View style={[styles.exploreIcon, { backgroundColor: `${item.tint}22` }]}>
                  <Text style={styles.exploreEmoji}>{item.icon}</Text>
                </View>
                <View style={styles.exploreCopy}>
                  <Text style={[styles.exploreLabel, { color: colors.text }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={[styles.exploreSub, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.sub}
                  </Text>
                </View>
                <Text style={[styles.exploreArrow, { color: colors.primary }]}>›</Text>
              </PressableScale>
            ))}
          </ScrollView>
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
                    <ProfileThumb uri={poster} style={styles.listPoster} />
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
                  <ProfileThumb uri={item.anime?.coverImage?.medium} style={styles.topPoster} />
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

          </FadeInView>
        )}

        {tab === 'reviews' && (
          <FadeInView key="reviews" style={styles.tabBody} offset={10} duration={320}>
            <Text style={styles.sectionTitle}>Your Reviews</Text>
            {user.reviews.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>⭐</Text>
                <Text style={styles.emptyText}>No reviews yet</Text>
                <Text style={styles.emptyHint}>Rate an anime from its detail page to see it here.</Text>
              </View>
            ) : (
              user.reviews.map((review: ReviewItem) => (
                <TouchableOpacity
                  key={review.id}
                  style={styles.reviewCard}
                  onPress={() => navigation.navigate('AnimeDetail', { id: review.mediaId })}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewScore}>★ {review.rating}/10</Text>
                    <Text style={styles.reviewTime}>{timeAgo(review.createdAt)}</Text>
                  </View>
                  <Text style={styles.reviewMeta}>Anime #{review.mediaId}</Text>
                  {review.comment ? (
                    <Text style={styles.reviewText} numberOfLines={4}>{review.comment}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
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
                  <ProfileThumb uri={activity.mediaImage} style={styles.activityImage} />
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

        {tab === 'more' && (
          <MoreTab profile={profile} onChanged={load} />
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
  avatarSlot: {
    marginRight: spacing.md,
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
  socialLink: {
    color: colors.primary,
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
  exploreSection: {
    marginTop: spacing.md,
  },
  exploreTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  exploreRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  exploreCard: {
    width: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
  },
  exploreIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreEmoji: { fontSize: 19 },
  exploreCopy: { flex: 1 },
  exploreLabel: { fontSize: 13, fontWeight: '800' },
  exploreSub: { fontSize: 10, marginTop: 2, lineHeight: 14 },
  exploreArrow: { fontSize: 20, fontWeight: '700' },
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
  reviewMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  moreBusy: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  moreSection: {
    marginBottom: spacing.lg,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm + 2,
  },
  moreIcon: {
    width: 30,
    fontSize: 18,
    textAlign: 'center',
  },
  moreLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  moreSub: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  moreChevron: {
    color: colors.textDim,
    fontSize: 20,
    marginLeft: spacing.xs,
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
  authTertiary: {
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
}));
