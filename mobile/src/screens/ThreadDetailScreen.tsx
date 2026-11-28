import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { ForumPost, ForumThread } from '../types';
import { stripMarkdown, timeAgo } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FadeInView from '../components/FadeInView';
import { SocialAvatar, UserName } from '../components/social/SocialBits';

export default function ThreadDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const primaryAccent = isLaunch ? '#22d3ee' : colors.primary;
  const threadId: string = route.params?.id;

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const fetchThread = useCallback(
    async (targetPage = 1) => {
      try {
        setError(null);
        const [data, user] = await Promise.all([
          api.forum.thread(threadId, targetPage),
          getCurrentUser().catch(() => null),
        ]);
        setThread(data.thread);
        setPosts((prev) => (targetPage === 1 ? data.posts : [...prev, ...data.posts]));
        setTotal(data.total);
        setPage(targetPage);
        setLoggedIn(!!user);
      } catch (e: any) {
        setError(e?.message || 'Could not load thread');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    fetchThread(1);
  }, [fetchThread]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchThread(1);
  };

  const submitReply = async () => {
    if (posting) return;
    if (!loggedIn) {
      navigation.navigate('Login');
      return;
    }
    const content = reply.trim();
    if (!content) return;
    setPosting(true);
    try {
      await api.forum.createPost(threadId, content);
      setReply('');
      await fetchThread(1);
    } catch (e: any) {
      Alert.alert('Could not reply', e?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const loadMore = () => {
    if (posts.length < total && !loading) fetchThread(page + 1);
  };

  if (loading) return <LoadingSpinner fullScreen />;
  if (error && !thread) return <ErrorView message={error} onRetry={() => fetchThread(1)} />;
  if (!thread) return <ErrorView message="Thread not found" onRetry={() => fetchThread(1)} />;

  const renderPost = ({ item, index }: { item: ForumPost; index: number }) => (
    <FadeInView
      style={styles.postCard}
      delay={Math.min(index * 40, 320)}
      offset={12}
      duration={340}
    >
      <View style={styles.postHeader}>
        <SocialAvatar uri={item.user?.avatar} name={item.user?.username || 'unknown'} size={34} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <UserName name={item.user?.username || 'unknown'} prefix="@" style={styles.postAuthor} />
          <Text style={styles.postTime}>
            {timeAgo(item.createdAt)} · #{index + 1}
          </Text>
        </View>
      </View>
      <Text style={styles.postContent}>{stripMarkdown(item.content)}</Text>
      {item.user?.signature ? (
        <Text style={styles.signature}>{item.user.signature}</Text>
      ) : null}
    </FadeInView>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 40}
    >
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryAccent} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.threadHeader}>
            <FadeInView delay={0}>
              <Text style={styles.category}>{thread.category?.name || 'General'}</Text>
              <Text style={styles.title}>{stripMarkdown(thread.title)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                <Text style={styles.threadMeta}>by </Text>
                <UserName name={thread.user?.username || 'unknown'} prefix="@" style={styles.threadMeta} />
                <Text style={styles.threadMeta}>· {timeAgo(thread.createdAt)} · {thread._count?.posts ?? total} posts</Text>
              </View>
            </FadeInView>
            {thread.animeTitle ? (
              <FadeInView delay={60}>
                <TouchableOpacity
                  style={styles.animeLink}
                  onPress={() =>
                    navigation.navigate('AnimeDetail', {
                      id: thread.animeId,
                      title: thread.animeTitle,
                    })
                  }
                >
                  <Text style={styles.animeLinkText} numberOfLines={1}>
                    About {thread.animeTitle} →
                  </Text>
                </TouchableOpacity>
              </FadeInView>
            ) : null}
            {thread.content ? (
              <FadeInView delay={110} style={styles.opCard}>
                <Text style={styles.postContent}>{stripMarkdown(thread.content)}</Text>
              </FadeInView>
            ) : null}
            <FadeInView delay={160}>
              <Text style={styles.repliesTitle}>
                {total} {total === 1 ? 'reply' : 'replies'}
              </Text>
            </FadeInView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No replies yet. Be the first!</Text>
          </View>
        }
        ListFooterComponent={
          posts.length < total ? (
            <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />
          ) : null
        }
      />

      <View style={[styles.replyBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {thread.isLocked ? (
          <Text style={styles.lockedText}>🔒 This thread is locked.</Text>
        ) : (
          <>
            <TextInput
              style={styles.replyInput}
              placeholder={loggedIn ? 'Write a reply…' : 'Sign in to reply'}
              placeholderTextColor={colors.textDim}
              value={reply}
              onChangeText={setReply}
              multiline
              maxLength={2000}
              editable={loggedIn}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!reply.trim() || posting) && { opacity: 0.5 },
              ]}
              onPress={submitReply}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#0a0a0f" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  threadHeader: {
    marginBottom: spacing.md,
  },
  category: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  threadMeta: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  animeLink: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.3)',
  },
  animeLinkText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  opCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  repliesTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  postCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  postAuthor: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  postTime: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  postContent: {
    color: colors.text,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  signature: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.sm,
    fontStyle: 'italic',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: fontSize.sm,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  replyInput: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#0a0a0f',
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  lockedText: {
    flex: 1,
    color: colors.textDim,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
}));
