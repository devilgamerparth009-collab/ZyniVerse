import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { ForumCategory, ForumThread } from '../types';
import { formatCount, stripMarkdown, timeAgo } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import AdBanner from '../components/AdBanner';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';

/** Social features that pair naturally with forum discussions. */
const EXPLORE_ITEMS: {
  key: string;
  icon: string;
  label: string;
  sub: string;
  tint: string;
  route: string;
}[] = [
  { key: 'messages', icon: '💬', label: 'Messages', sub: 'Chat with other fans', tint: '#22d3ee', route: 'Messages' },
  { key: 'friends', icon: '🤝', label: 'Friends', sub: 'Find people to follow', tint: '#ec4899', route: 'Friends' },
  { key: 'watchparty', icon: '👥', label: 'Watch Party', sub: 'Watch anime together', tint: '#38bdf8', route: 'WatchParty' },
];

type SortKey = 'recent' | 'popular' | 'top';
const SORTS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'recent', label: 'Recent', icon: '⏱️' },
  { key: 'popular', label: 'Trending', icon: '🔥' },
  { key: 'top', label: 'Top Rated', icon: '⭐' },
];

export default function ForumScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeCategory, setComposeCategory] = useState<string | null>(null);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 6 }),
    ]).start();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [cats, threadPage, user] = await Promise.all([
        api.forum.categories().catch(() => [] as ForumCategory[]),
        api.forum.threads({
          sort,
          category: selectedCat || undefined,
          limit: 20,
        }).catch(() => ({ threads: [] as ForumThread[], total: 0, page: 1, limit: 20 })),
        getCurrentUser().catch(() => null),
      ]);
      setCategories(cats);
      setThreads(threadPage.threads);
      setLoggedIn(!!user);
      if (!composeCategory && cats.length > 0) setComposeCategory(cats[0].id);
    } catch (e: any) {
      setError(e?.message || 'Could not load forum discussions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort, selectedCat, composeCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const runSearch = async () => {
    if (!search.trim()) {
      fetchData();
      return;
    }
    setLoading(true);
    try {
      const page = await api.forum.threads({
        search: search.trim(),
        category: selectedCat || undefined,
        sort,
        limit: 30,
      });
      setThreads(page.threads);
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const openCompose = () => {
    if (!loggedIn) {
      navigation.navigate('Login');
      return;
    }
    setComposeOpen(true);
  };

  const submitThread = async () => {
    if (submitting) return;
    if (!composeTitle.trim() || !composeContent.trim()) {
      Alert.alert('Missing Info', 'Please add both a title and details.');
      return;
    }
    setSubmitting(true);
    try {
      const thread = await api.forum.createThread({
        categoryId: composeCategory || undefined,
        title: composeTitle.trim(),
        content: composeContent.trim(),
      });
      setComposeOpen(false);
      setComposeTitle('');
      setComposeContent('');
      setSearch('');
      await fetchData();
      if (thread?.id) {
        navigation.navigate('ThreadDetail', { id: thread.id, title: thread.title });
      }
    } catch (e: any) {
      Alert.alert('Could not post', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = isLaunch ? '#22d3ee' : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Forum Header Banner */}
        <Animated.View
          style={[
            styles.heroHeader,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View>
              <View style={styles.liveTagRow}>
                <View style={[styles.liveDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.liveTagText}>COMMUNITY FORUM</Text>
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Anime Hub</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                Theories, episode recaps & community discussions
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.postButton, { backgroundColor: primaryColor, shadowColor: primaryColor }]}
              onPress={openCompose}
              activeOpacity={0.8}
            >
              <Text style={styles.postButtonText}>✍️ Post</Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.searchIcon, { color: colors.textDim }]}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search anime topics, manga, characters..."
              placeholderTextColor={colors.textDim}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={runSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  fetchData();
                }}
              >
                <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Explore this feature */}
        <FadeInView delay={110} style={styles.exploreSection}>
          <Text style={[styles.exploreTitle, { color: primaryColor }]}>EXPLORE THIS FEATURE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exploreRow}
          >
            {EXPLORE_ITEMS.map((item) => (
              <PressableScale
                key={item.key}
                accessibilityLabel={`Explore ${item.label}`}
                onPress={() => navigation.navigate(item.route)}
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
                <Text style={[styles.exploreArrow, { color: primaryColor }]}>›</Text>
              </PressableScale>
            ))}
          </ScrollView>
        </FadeInView>

        {/* Category Pill Carousel */}
        <View style={styles.catSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catList}
          >
            <TouchableOpacity
              style={[
                styles.catPill,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedCat === null && {
                  backgroundColor: primaryColor,
                  borderColor: primaryColor,
                },
              ]}
              onPress={() => setSelectedCat(null)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.catPillText,
                  { color: selectedCat === null ? '#ffffff' : colors.textMuted },
                ]}
              >
                ✨ All Topics
              </Text>
            </TouchableOpacity>

            {categories.map((c) => {
              const active = selectedCat === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.catPill,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    active && { backgroundColor: primaryColor, borderColor: primaryColor },
                  ]}
                  onPress={() => setSelectedCat(active ? null : c.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      { color: active ? '#ffffff' : colors.textMuted },
                    ]}
                  >
                    💬 {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sort Filter Selector */}
        <View style={styles.sortRow}>
          <Text style={[styles.sortHeading, { color: colors.textMuted }]}>
            {threads.length} Discussions
          </Text>
          <View style={styles.sortButtonGroup}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.sortButton,
                    active && {
                      backgroundColor: primaryColor,
                    },
                  ]}
                  onPress={() => setSort(s.key)}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      { color: active ? '#ffffff' : colors.textDim },
                    ]}
                  >
                    {s.icon} {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Adsterra Sponsored Ad in Feed */}
        <AdBanner placement="forum-feed" />

        {/* Threads List */}
        {loading && threads.length === 0 ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : error && threads.length === 0 ? (
          <ErrorView message={error} onRetry={fetchData} />
        ) : threads.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>💬</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No threads found</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Be the first to start a conversation on this topic!
            </Text>
            <TouchableOpacity
              style={[styles.emptyAction, { backgroundColor: primaryColor }]}
              onPress={openCompose}
            >
              <Text style={styles.emptyActionText}>Start a Thread ➔</Text>
            </TouchableOpacity>
          </View>
        ) : (
          threads.map((thread, index) => {
            const author = thread.author?.username || 'Anime Fan';
            const cleanContent = stripMarkdown(thread.content || '');

            return (
              <React.Fragment key={thread.id}>
                <TouchableOpacity
                  style={[
                    styles.threadCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('ThreadDetail', {
                      id: thread.id,
                      title: thread.title,
                    })
                  }
                >
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.authorRow}>
                      <View style={[styles.avatarCircle, { backgroundColor: primaryColor }]}>
                        <Text style={styles.avatarText}>
                          {author.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.authorName, { color: colors.text }]}>
                          @{author}
                        </Text>
                        <Text style={[styles.postTime, { color: colors.textDim }]}>
                          {timeAgo(thread.createdAt)}
                        </Text>
                      </View>
                    </View>

                    {thread.category && (
                      <View
                        style={[
                          styles.catBadge,
                          { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.catBadgeText, { color: primaryColor }]}>
                          {thread.category.name}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Thread Title */}
                  <Text style={[styles.threadTitle, { color: colors.text }]} numberOfLines={2}>
                    {thread.isPinned ? '📌 ' : ''}
                    {thread.title}
                  </Text>

                  {/* Content Preview */}
                  {cleanContent.length > 0 && (
                    <Text
                      style={[styles.threadPreview, { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {cleanContent}
                    </Text>
                  )}

                  {/* Card Footer Counter */}
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <View style={styles.counterGroup}>
                      <Text style={[styles.counterText, { color: colors.textMuted }]}>
                        🔥 {formatCount(thread.upvotes || 0)} upvotes
                      </Text>
                      <Text style={[styles.counterText, { color: colors.textMuted }]}>
                        💬 {formatCount(thread.postCount || 0)} replies
                      </Text>
                    </View>

                    <Text style={[styles.readArrow, { color: primaryColor }]}>
                      Read Thread ➔
                    </Text>
                  </View>
                </TouchableOpacity>

              </React.Fragment>
            );
          })
        )}
      </ScrollView>

      {/* Compose Thread Modal */}
      {composeOpen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.75)' }]}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create New Thread</Text>
              <TouchableOpacity onPress={() => setComposeOpen(false)}>
                <Text style={{ fontSize: 20, color: colors.textDim }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="What's your discussion title?"
              placeholderTextColor={colors.textDim}
              value={composeTitle}
              onChangeText={setComposeTitle}
            />

            <TextInput
              style={[
                styles.modalTextarea,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Share your thoughts, theories, or ask questions..."
              placeholderTextColor={colors.textDim}
              value={composeContent}
              onChangeText={setComposeContent}
              multiline
              numberOfLines={5}
            />

            <TouchableOpacity
              style={[
                styles.modalSubmit,
                { backgroundColor: primaryColor },
                submitting && { opacity: 0.6 },
              ]}
              onPress={submitThread}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.modalSubmitText}>Publish Thread 🚀</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroHeader: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveTagText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  postButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  postButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchIcon: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  exploreSection: {
    marginTop: 2,
    marginBottom: 12,
  },
  exploreTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  exploreRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  exploreCard: {
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
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
  catSection: {
    marginBottom: 12,
  },
  catList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sortHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortButtonGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  sortButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  threadCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  postTime: {
    fontSize: 10,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
  },
  threadPreview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  counterGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  readArrow: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyAction: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalTextarea: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalSubmit: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
