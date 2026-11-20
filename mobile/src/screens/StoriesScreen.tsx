import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import SafeImage from '../components/SafeImage';
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
import { api, mediaImageUrl } from '../services/api';
import { ChannelSummary, StoryItem } from '../types/social';
import { spacing, fontSize, borderRadius } from '../theme';
import { formatCount, timeAgo } from '../utils/helpers';
import { Linking } from 'react-native';
import { openTrustedExternalUrl } from '../utils/safeLinks';

const STORY_MS = 5000;
type MediaType = 'image' | 'video';
type StoryGroup = {
  key: string;
  label: string;
  avatar: string | null;
  storyIds: string[];
  unseen: number;
};

export default function StoriesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { checking, signedIn } = useSocialAuth();

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const viewedRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const [formOpen, setFormOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [caption, setCaption] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setStories(await api.stories.list(60));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load stories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && signedIn) void load();
  }, [checking, signedIn, load]);

  useEffect(() => {
    if (!formOpen) return;
    let active = true;
    setChannelsLoading(true);
    setChannelsError(null);
    Promise.all([api.channels.list(), api.auth.current().catch(() => null)])
      .then(([list, me]) => {
        if (!active) return;
        setChannels(list);
        setMeId(me?.id || null);
      })
      .catch((e: unknown) => {
        if (active) setChannelsError(e instanceof Error ? e.message : 'Could not load your channels');
      })
      .finally(() => {
        if (active) setChannelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [formOpen]);

  const isViewed = useCallback(
    (story: StoryItem) => story.viewed || viewedIds.includes(story.id),
    [viewedIds]
  );

  const groups = useMemo<StoryGroup[]>(() => {
    const map = new Map<string, StoryGroup>();
    stories.forEach((story) => {
      const key = story.channel ? `channel:${story.channel.id}` : `user:${story.user.id}`;
      const label = story.channel?.name || story.user.username;
      const avatar = story.channel?.iconUrl || story.user.avatar;
      const existing = map.get(key);
      if (existing) {
        existing.storyIds.push(story.id);
        if (!isViewed(story)) existing.unseen += 1;
      } else {
        map.set(key, {
          key,
          label,
          avatar,
          storyIds: [story.id],
          unseen: isViewed(story) ? 0 : 1,
        });
      }
    });
    return Array.from(map.values());
  }, [stories, isViewed]);

  // Keep the first flat index of each group for the ring tap target.
  const groupStartIndex = useCallback(
    (key: string) => {
      const group = groups.find((g) => g.key === key);
      if (!group) return 0;
      const idx = stories.findIndex((s) => group.storyIds.includes(s.id));
      return idx < 0 ? 0 : idx;
    },
    [groups, stories]
  );

  const openViewer = (group: StoryGroup) => {
    const start = groupStartIndex(group.key);
    const firstUnseen = stories.findIndex(
      (s, i) => i >= start && group.storyIds.includes(s.id) && !isViewed(s)
    );
    setViewerIndex(firstUnseen >= 0 ? firstUnseen : start);
  };

  const markViewed = useCallback((story: StoryItem) => {
    if (story.viewed || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    setViewedIds((ids) => [...ids, story.id]);
    api.stories.view(story.id).catch(() => {});
  }, []);

  const advance = useCallback(() => {
    setViewerIndex((current) => {
      if (current === null) return null;
      return current + 1 >= stories.length ? null : current + 1;
    });
  }, [stories.length]);

  const goBack = useCallback(() => {
    setViewerIndex((current) => (current === null || current <= 0 ? null : current - 1));
  }, []);

  useEffect(() => {
    if (viewerIndex === null) return;
    const story = stories[viewerIndex];
    if (!story) {
      setViewerIndex(null);
      return;
    }
    markViewed(story);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) advance();
    });
    return () => animation.stop();
  }, [viewerIndex, stories, markViewed, advance, progress]);

  const createStory = async () => {
    const url = mediaUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setFormError('Enter an image or video link that starts with https://');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const story = await api.stories.create({
        mediaUrl: url,
        mediaType,
        caption: caption.trim() || undefined,
        channelId: channelId || undefined,
      });
      setStories((list) => [story, ...list.filter((s) => s.id !== story.id)]);
      setMediaUrl('');
      setCaption('');
      setChannelId(null);
      setFormOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not share story');
    } finally {
      setCreating(false);
    }
  };

  const ownerChannels = channels.filter((c) => !!meId && c.owner.id === meId);

  const renderRings = () => (
    <View>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Stories</Text>
        <TouchableOpacity
          style={[styles.createBtn, { borderColor: colors.primary }]}
          onPress={() => setFormOpen((v) => !v)}
          accessibilityLabel="Create story"
        >
          <Text style={[styles.createBtnText, { color: colors.primary }]}>
            {formOpen ? 'Close' : '+ New story'}
          </Text>
        </TouchableOpacity>
      </View>

      {formOpen && (
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Share a story</Text>
          <TextInput
            value={mediaUrl}
            onChangeText={setMediaUrl}
            placeholder="Image or video link"
            placeholderTextColor={colors.textDim}
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.mediaTypes}>
            {(['image', 'video'] as MediaType[]).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setMediaType(type)}
                style={[
                  styles.mediaTypeBtn,
                  { borderColor: mediaType === type ? colors.primary : colors.border },
                  mediaType === type && { backgroundColor: `${colors.primary}22` },
                ]}
              >
                <Text style={[styles.mediaTypeText, { color: mediaType === type ? colors.primary : colors.textMuted }]}>
                  {type === 'image' ? 'Image' : 'Video'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Caption (optional)"
            placeholderTextColor={colors.textDim}
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            maxLength={240}
            multiline
          />
          <Text style={[styles.formHint, { color: colors.textDim }]}>Post as</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelChips}>
            <TouchableOpacity
              onPress={() => setChannelId(null)}
              style={[
                styles.channelChip,
                { borderColor: channelId === null ? colors.primary : colors.border },
                channelId === null && { backgroundColor: `${colors.primary}22` },
              ]}
            >
              <Text style={[styles.channelChipText, { color: channelId === null ? colors.primary : colors.textMuted }]}>
                My story
              </Text>
            </TouchableOpacity>
            {ownerChannels.map((channel) => (
              <TouchableOpacity
                key={channel.id}
                onPress={() => setChannelId(channel.id)}
                style={[
                  styles.channelChip,
                  { borderColor: channelId === channel.id ? colors.primary : colors.border },
                  channelId === channel.id && { backgroundColor: `${colors.primary}22` },
                ]}
              >
                <Text style={[styles.channelChipText, { color: channelId === channel.id ? colors.primary : colors.textMuted }]}>
                  {channel.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {channelsLoading && <Text style={[styles.formHint, { color: colors.textDim }]}>Loading your channels…</Text>}
          {!!channelsError && <Text style={[styles.formError, { color: colors.error }]}>{channelsError}</Text>}
          {!!formError && <Text style={[styles.formError, { color: colors.error }]}>{formError}</Text>}
          <PillButton label={creating ? 'Sharing…' : 'Share story'} busy={creating} onPress={() => void createStory()} />
        </View>
      )}

      {groups.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ringRow}
        >
          {groups.map((group) => (
            <TouchableOpacity
              key={group.key}
              style={styles.ringItem}
              onPress={() => openViewer(group)}
              accessibilityLabel={`View stories from ${group.label}`}
            >
              <SocialAvatar
                name={group.label}
                uri={group.avatar}
                size={62}
                ring={group.unseen > 0 ? colors.primary : colors.border}
              />
              <Text style={[styles.ringLabel, { color: colors.text }]} numberOfLines={1}>
                {group.label}
              </Text>
              {group.unseen > 0 && (
                <Text style={[styles.ringMeta, { color: colors.primary }]}>New</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const activeStory = viewerIndex === null ? null : stories[viewerIndex] || null;
  const activeUri = activeStory ? mediaImageUrl(activeStory.mediaUrl) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Stories" emoji="✨" subtitle="Moments from the community" />

      {checking ? (
        <LoadingBlock label="Checking your session…" />
      ) : !signedIn ? (
        <SignedOutCard message="Sign in to watch stories and share your own." />
      ) : loading ? (
        <LoadingBlock label="Loading stories…" />
      ) : error && stories.length === 0 ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <>
          {!!error && <Text style={[styles.inlineError, { color: colors.error }]}>{error}</Text>}
          <FlatList
            data={stories}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderRings}
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
                emoji="✨"
                title="No stories yet"
                message="Be the first to share a moment."
                actionLabel="Create a story"
                onAction={() => setFormOpen(true)}
              />
            }
            renderItem={({ item, index }) => {
              const groupLabel = item.channel?.name || item.user.username;
              return (
                <TouchableOpacity
                  style={[styles.storyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setViewerIndex(index)}
                  activeOpacity={0.8}
                >
                  <SafeImage
                    uri={item.mediaUrl}
                    fallbackLabel={groupLabel}
                    style={styles.storyThumb}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.storyAuthor, { color: colors.text }]} numberOfLines={1}>
                      {groupLabel}
                    </Text>
                    {!!item.caption && (
                      <Text style={[styles.storyCaption, { color: colors.textMuted }]} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    )}
                    <Text style={[styles.storyMeta, { color: colors.textDim }]}>
                      {timeAgo(item.createdAt)} · {formatCount(item.viewCount)} views
                    </Text>
                  </View>
                  {!isViewed(item) && <View style={[styles.unseenDot, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      <Modal
        visible={!!activeStory}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setViewerIndex(null)}
      >
        {activeStory && (
          <View style={styles.viewer}>
            {activeStory.mediaType === 'image' && activeUri ? (
              <Image source={{ uri: activeUri }} style={styles.viewerImage} resizeMode="cover" />
            ) : (
              <View style={styles.viewerVideoFallback}>
                <Text style={styles.viewerVideoEmoji}>🎬</Text>
                <Text style={styles.viewerVideoTitle}>Video story</Text>
                <TouchableOpacity
                  style={[styles.viewerLink, { borderColor: colors.primary }]}
                  onPress={async () => {
                    const opened = await openTrustedExternalUrl(activeStory.mediaUrl);
                    if (opened) return;
                    if (/^https?:\/\//i.test(activeStory.mediaUrl)) {
                      Linking.openURL(activeStory.mediaUrl).catch(() => {});
                    }
                  }}
                >
                  <Text style={[styles.viewerLinkText, { color: colors.primary }]}>Open video</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.tapRow}>
              <TouchableOpacity style={styles.tapHalf} onPress={goBack} accessibilityLabel="Previous story" />
              <TouchableOpacity style={styles.tapHalf} onPress={advance} accessibilityLabel="Next story" />
            </View>

            <View style={styles.viewerTop}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    },
                  ]}
                />
              </View>
              <View style={styles.viewerIdentity}>
                <SocialAvatar
                  name={activeStory.channel?.name || activeStory.user.username}
                  uri={activeStory.channel?.iconUrl || activeStory.user.avatar}
                  size={34}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewerName} numberOfLines={1}>
                    {activeStory.channel?.name || activeStory.user.username}
                  </Text>
                  <Text style={styles.viewerTime}>{timeAgo(activeStory.createdAt)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setViewerIndex(null)}
                  style={styles.viewerClose}
                  accessibilityLabel="Close story"
                >
                  <Text style={styles.viewerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.viewerBottom} pointerEvents="none">
              {!!activeStory.caption && (
                <Text style={styles.viewerCaption} numberOfLines={3}>
                  {activeStory.caption}
                </Text>
              )}
              <Text style={styles.viewerCounter}>
                {(viewerIndex || 0) + 1} / {stories.length}
              </Text>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inlineError: { fontSize: fontSize.xs, textAlign: 'center', paddingTop: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800' },
  createBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 6 },
  createBtnText: { fontSize: fontSize.xs, fontWeight: '800' },
  form: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  formTitle: { fontSize: fontSize.sm, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 10, minHeight: 40, fontSize: fontSize.sm },
  mediaTypes: { flexDirection: 'row', gap: spacing.sm },
  mediaTypeBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 14, paddingVertical: 6 },
  mediaTypeText: { fontSize: fontSize.xs, fontWeight: '800' },
  formHint: { fontSize: 10, fontWeight: '700' },
  formError: { fontSize: fontSize.xs },
  channelChips: { gap: 6, paddingBottom: 4 },
  channelChip: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 6 },
  channelChipText: { fontSize: 10, fontWeight: '800' },
  ringRow: { gap: spacing.md, paddingVertical: spacing.sm, paddingBottom: spacing.md },
  ringItem: { width: 72, alignItems: 'center' },
  ringLabel: { fontSize: 10, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  ringMeta: { fontSize: 9, fontWeight: '800', marginTop: 1 },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  storyThumb: { width: 54, height: 68, borderRadius: borderRadius.sm },
  storyAuthor: { fontSize: fontSize.sm, fontWeight: '800' },
  storyCaption: { fontSize: fontSize.xs, marginTop: 2, lineHeight: 17 },
  storyMeta: { fontSize: 10, marginTop: 4 },
  unseenDot: { width: 8, height: 8, borderRadius: 4 },
  viewer: { flex: 1, backgroundColor: '#050508' },
  viewerImage: { ...StyleSheet.absoluteFillObject },
  viewerVideoFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10 },
  viewerVideoEmoji: { fontSize: 54 },
  viewerVideoTitle: { color: '#fff', fontSize: fontSize.md, fontWeight: '800' },
  viewerLink: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 16, paddingVertical: 8 },
  viewerLinkText: { fontSize: fontSize.sm, fontWeight: '800' },
  tapRow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 1 },
  tapHalf: { flex: 1 },
  viewerTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: spacing.md, zIndex: 3 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  viewerIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 12 },
  viewerName: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },
  viewerTime: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 2 },
  viewerClose: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  viewerCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  viewerBottom: { position: 'absolute', left: 0, right: 0, bottom: 44, paddingHorizontal: spacing.lg, alignItems: 'center', zIndex: 2 },
  viewerCaption: { color: '#fff', fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, textShadowColor: '#000', textShadowRadius: 4 },
  viewerCounter: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 10 },
});
