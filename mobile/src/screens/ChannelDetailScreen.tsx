import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import SafeImage from '../components/SafeImage';
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PillButton,
  SignedOutCard,
} from '../components/social/SocialBits';
import { useSocialAuth } from '../hooks/useSocialAuth';
import { useTheme } from '../hooks/useTheme';
import type { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { ChannelPostView, ChannelSummary } from '../types/social';
import { spacing, fontSize, borderRadius } from '../theme';
import { formatCount, timeAgo } from '../utils/helpers';

type DetailRoute = RouteProp<RootStackParamList, 'ChannelDetail'>;
const REACTIONS = ['👍', '❤️', '🔥', '😂'];

export default function ChannelDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();
  const { slug } = route.params;
  const { colors } = useTheme();
  const { checking, signedIn } = useSocialAuth();

  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [posts, setPosts] = useState<ChannelPostView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [busyPosts, setBusyPosts] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [pinned, setPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [detail, page, me] = await Promise.all([
        api.channels.get(slug),
        api.channels.posts(slug, 30),
        api.auth.current().catch(() => null),
      ]);
      setChannel(detail);
      setPosts(page.posts);
      setNextCursor(page.nextCursor);
      setMeId(me?.id || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load this channel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!checking && signedIn) void load();
  }, [checking, signedIn, load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.channels.posts(slug, 30, nextCursor);
      setPosts((list) => [...list, ...page.posts.filter((p) => !list.some((x) => x.id === p.id))]);
      setNextCursor(page.nextCursor);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load more posts');
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSubscribe = async () => {
    if (!channel || subscribing) return;
    const next = !channel.isSubscribed;
    setSubscribing(true);
    const apply = (subscribed: boolean, count: number) =>
      setChannel((c) => (c ? { ...c, isSubscribed: subscribed, subscriberCount: count } : c));
    apply(next, channel.subscriberCount + (next ? 1 : -1));
    try {
      const result = await api.channels.subscribe(slug, next);
      apply(!!result.subscribed, Number(result.subscriberCount) || 0);
    } catch (e: unknown) {
      apply(!next, channel.subscriberCount);
      setError(e instanceof Error ? e.message : 'Could not update subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const publish = async () => {
    const text = content.trim();
    if (!text) {
      setComposerError('Write something before posting.');
      return;
    }
    if (text.length > 2000) {
      setComposerError('Keep posts under 2000 characters.');
      return;
    }
    setPosting(true);
    setComposerError(null);
    try {
      const post = await api.channels.createPost(slug, {
        content: text,
        imageUrl: imageUrl.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        linkLabel: linkLabel.trim() || undefined,
        pinned,
      });
      setPosts((list) => [post, ...list.filter((p) => p.id !== post.id)]);
      setChannel((c) => (c ? { ...c, postCount: c.postCount + 1 } : c));
      setContent('');
      setImageUrl('');
      setLinkUrl('');
      setLinkLabel('');
      setPinned(false);
    } catch (e: unknown) {
      setComposerError(e instanceof Error ? e.message : 'Could not publish post');
    } finally {
      setPosting(false);
    }
  };

  const react = async (post: ChannelPostView, emoji: string) => {
    if (busyPosts.includes(post.id)) return;
    setBusyPosts((ids) => [...ids, post.id]);
    try {
      const result = await api.channels.reactPost(slug, post.id, emoji);
      setPosts((list) =>
        list.map((p) =>
          p.id === post.id ? { ...p, reactions: result.reactions, myReactions: result.myReactions } : p
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save reaction');
    } finally {
      setBusyPosts((ids) => ids.filter((id) => id !== post.id));
    }
  };

  const removePost = (post: ChannelPostView) => {
    Alert.alert('Delete post', 'Delete this post from the channel?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyPosts((ids) => [...ids, post.id]);
          try {
            await api.channels.deletePost(slug, post.id);
            setPosts((list) => list.filter((p) => p.id !== post.id));
            setChannel((c) => (c ? { ...c, postCount: Math.max(0, c.postCount - 1) } : c));
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Could not delete post');
          } finally {
            setBusyPosts((ids) => ids.filter((id) => id !== post.id));
          }
        },
      },
    ]);
  };

  const renderPost = ({ item }: { item: ChannelPostView }) => {
    const canDelete = item.canManage || (!!meId && item.author.id === meId);
    return (
      <View style={[styles.post, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.postHead}>
          <TouchableOpacity
            style={styles.postAuthor}
            onPress={() => navigation.navigate('UserProfile', { username: item.author.username })}
            activeOpacity={0.8}
          >
            <Text style={[styles.authorName, { color: colors.text }]}>{item.author.username}</Text>
            <Text style={[styles.postTime, { color: colors.textDim }]}>{timeAgo(item.createdAt)}</Text>
          </TouchableOpacity>
          {item.pinned && (
            <View style={[styles.badge, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>Pinned</Text>
            </View>
          )}
        </View>

        <Text style={[styles.postText, { color: colors.text }]}>{item.content}</Text>

        {!!item.imageUrl && (
          <SafeImage
            uri={item.imageUrl}
            fallbackLabel="Channel image"
            style={[styles.postImage, { borderColor: colors.border }]}
            resizeMode="cover"
          />
        )}

        {!!item.linkUrl && (
          <TouchableOpacity
            style={[styles.linkBox, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => Linking.openURL(item.linkUrl || '').catch(() => {})}
            activeOpacity={0.8}
          >
            <Text style={[styles.linkLabel, { color: colors.primary }]} numberOfLines={1}>
              🔗 {item.linkLabel || 'Open link'}
            </Text>
            <Text style={[styles.linkUrl, { color: colors.textDim }]} numberOfLines={1}>
              {item.linkUrl}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.reactionRow}>
          {REACTIONS.map((emoji) => {
            const count = item.reactions?.[emoji] || 0;
            const mine = (item.myReactions || []).includes(emoji);
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionBtn,
                  { borderColor: mine ? colors.primary : colors.border },
                  mine && { backgroundColor: `${colors.primary}22` },
                ]}
                onPress={() => react(item, emoji)}
                disabled={busyPosts.includes(item.id)}
                accessibilityLabel={`React ${emoji}`}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {count > 0 && <Text style={[styles.reactionCount, { color: colors.textMuted }]}>{count}</Text>}
              </TouchableOpacity>
            );
          })}
          {canDelete && (
            <TouchableOpacity
              style={[styles.deleteBtn, { borderColor: colors.border }]}
              onPress={() => removePost(item)}
              accessibilityLabel="Delete post"
            >
              <Text style={[styles.deleteText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    if (!channel) return null;
    const isOwner = !!meId && channel.owner.id === meId;
    return (
      <View>
        {!!channel.coverUrl && (
          <SafeImage
            uri={channel.coverUrl}
            fallbackLabel={channel.name}
            style={[styles.cover, { borderColor: colors.border }]}
          />
        )}
        <View style={[styles.channelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.channelHead}>
            <SafeImage
              uri={channel.iconUrl}
              fallbackLabel={channel.name}
              style={[styles.channelIcon, { borderColor: colors.border }]}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
                  {channel.name}
                </Text>
                {channel.isOfficial && (
                  <View style={[styles.badge, { backgroundColor: `${colors.primary}22` }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>Official</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.channelMeta, { color: colors.textDim }]} numberOfLines={1}>
                @{channel.slug} · {formatCount(channel.subscriberCount)} subscribers · {formatCount(channel.postCount)} posts
              </Text>
            </View>
          </View>

          {!!channel.description && (
            <Text style={[styles.channelDescription, { color: colors.textMuted }]}>
              {channel.description}
            </Text>
          )}

          <View style={styles.channelActions}>
            <PillButton
              label={channel.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              variant={channel.isSubscribed ? 'outline' : 'primary'}
              busy={subscribing}
              onPress={() => void toggleSubscribe()}
            />
            <TouchableOpacity
              onPress={() => navigation.navigate('UserProfile', { username: channel.owner.username })}
              activeOpacity={0.8}
            >
              <Text style={[styles.owner, { color: colors.textMuted }]}>
                By {channel.owner.username}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isOwner && (
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>New post</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Share an update with subscribers…"
              placeholderTextColor={colors.textDim}
              style={[styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              multiline
              maxLength={2000}
            />
            <View style={styles.composerFields}>
              <TextInput
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="Image URL (optional)"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="Link URL (optional)"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={linkLabel}
                onChangeText={setLinkLabel}
                placeholder="Link label (optional)"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={styles.pinToggle}
              onPress={() => setPinned((v) => !v)}
              accessibilityLabel="Pin post to top"
            >
              <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: pinned ? colors.primary : 'transparent' }]}>
                {pinned && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={[styles.pinText, { color: colors.textMuted }]}>Pin to top</Text>
            </TouchableOpacity>
            {!!composerError && <Text style={[styles.composerError, { color: colors.error }]}>{composerError}</Text>}
            <PillButton label={posting ? 'Publishing…' : 'Publish post'} busy={posting} onPress={() => void publish()} />
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Posts</Text>
          <Text style={[styles.sectionCount, { color: colors.textDim }]}>{formatCount(channel.postCount)}</Text>
        </View>
      </View>
    );
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Channel" emoji="📣" />
        <LoadingBlock label="Checking your session…" />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Channel" emoji="📣" />
        <SignedOutCard message="Sign in to read channel posts and subscribe." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={channel?.name || 'Channel'}
        emoji="📣"
        subtitle={channel ? `@${channel.slug}` : 'Broadcast channel'}
      />

      {loading ? (
        <LoadingBlock label="Loading channel…" />
      ) : error && !channel ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <>
          {!!error && <Text style={[styles.inlineError, { color: colors.error }]}>{error}</Text>}
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            ListHeaderComponent={renderHeader}
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
              <EmptyBlock emoji="📝" title="No posts yet" message="Posts from this channel will appear here." />
            }
            ListFooterComponent={
              nextCursor ? (
                <TouchableOpacity
                  style={[styles.moreBtn, { borderColor: colors.border }]}
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={[styles.moreText, { color: colors.primary }]}>Load more</Text>
                  )}
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
  cover: { height: 120, borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.sm },
  channelCard: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  channelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  channelIcon: { width: 50, height: 50, borderRadius: 12, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  channelName: { fontSize: fontSize.md, fontWeight: '900', flexShrink: 1 },
  channelMeta: { fontSize: 10, marginTop: 3 },
  channelDescription: { fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.sm },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText: { fontSize: 9, fontWeight: '900' },
  channelActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  owner: { fontSize: fontSize.xs },
  composer: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionCount: { fontSize: fontSize.xs },
  textArea: { borderWidth: 1, borderRadius: borderRadius.sm, padding: 10, minHeight: 90, fontSize: fontSize.sm, marginTop: spacing.sm, textAlignVertical: 'top' },
  composerFields: { gap: 6, marginTop: spacing.sm },
  input: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 10, height: 38, fontSize: fontSize.xs },
  pinToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#0a0a0f', fontSize: 12, fontWeight: '900' },
  pinText: { fontSize: fontSize.xs },
  composerError: { fontSize: fontSize.xs, marginBottom: 6 },
  post: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  postHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  authorName: { fontSize: fontSize.sm, fontWeight: '800' },
  postTime: { fontSize: 10 },
  postText: { fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.sm },
  postImage: { width: '100%', height: 180, borderRadius: borderRadius.sm, borderWidth: 1, marginTop: spacing.sm },
  linkBox: { borderWidth: 1, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  linkLabel: { fontSize: fontSize.xs, fontWeight: '800' },
  linkUrl: { fontSize: 10, marginTop: 2 },
  reactionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, flexWrap: 'wrap' },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 10, fontWeight: '700' },
  deleteBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 5 },
  deleteText: { fontSize: 10, fontWeight: '800' },
  moreBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingVertical: 10, alignItems: 'center', marginTop: spacing.sm },
  moreText: { fontSize: fontSize.sm, fontWeight: '800' },
});
