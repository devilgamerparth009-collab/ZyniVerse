import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { Reel } from '../types';
import PressableScale from '../components/PressableScale';
import { spacing, borderRadius } from '../theme';
import { timeAgo } from '../utils/helpers';

const MUTED_KEY = 'zv_reels_muted';

/** 1.2K / 3.4M — same formatting the website uses. */
function formatCount(n: number): string {
  if (!n || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function videoHtml(url: string, muted: boolean) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
  html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
  video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block}
  </style></head><body>
  <video id="v" src="${url}" autoplay ${muted ? 'muted' : ''} loop playsinline webkit-playsinline preload="metadata"></video>
  <script>
    var v=document.getElementById('v');
    var last=-1;
    function post(){
      try{
        var d=v.duration||0, p=d?Math.min(1,v.currentTime/d):0;
        var pct=Math.round(p*100);
        if(pct!==last){
          last=pct;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'progress',pct:pct,dur:d}));
        }
      }catch(e){}
    }
    v.addEventListener('timeupdate',post);
    v.addEventListener('loadedmetadata',post);
    v.addEventListener('click',function(){ if(v.paused){v.play();} else {v.pause();} });
  </script>
  </body></html>`;
}

function HeartBurst({ on }: { on: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();
  }, [on, scale]);
  return (
    <Animated.Text style={{ fontSize: 26, transform: [{ scale }] }}>
      {on ? '❤️' : '🤍'}
    </Animated.Text>
  );
}

function Toast({ text, tint }: { text: string; tint: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 9 }),
    ]).start();
  }, [opacity, translateY]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { backgroundColor: tint, opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.toastText}>{text}</Text>
    </Animated.View>
  );
}

interface ReelComment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatar?: string | null;
  };
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch } = useTheme();
  const tint = isLaunch ? '#22d3ee' : colors.primary;
  const { height: windowH } = useWindowDimensions();
  const [measuredHeight, setMeasuredHeight] = useState<number>(0);
  const containerHeight = measuredHeight > 0 ? measuredHeight : windowH;

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(false);
  const [likes, setLikes] = useState<Record<string, boolean>>({});

  // Website parity: For You / Following feed, Newest / Popular sort.
  const [feed, setFeed] = useState<'foryou' | 'following'>('foryou');
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [captionOpen, setCaptionOpen] = useState<Record<string, boolean>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Double tap state
  const lastTapRef = useRef<number>(0);
  const [showCenterHeart, setShowCenterHeart] = useState(false);
  const centerHeartAnim = useRef(new Animated.Value(0)).current;

  // Comments modal state
  const [commentsModal, setCommentsModal] = useState(false);
  const [activeReelForComments, setActiveReelForComments] = useState<Reel | null>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Report modal state
  const [reportModal, setReportModal] = useState(false);
  const [activeReelForReport, setActiveReelForReport] = useState<Reel | null>(null);
  const [reporting, setReporting] = useState(false);

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadVideoUrl, setUploadVideoUrl] = useState('');
  const [uploadThumbUrl, setUploadThumbUrl] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadAnimeTitle, setUploadAnimeTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(
    async (nextPage = 1) => {
      try {
        const data = await api.fun.reels(nextPage, 8, sort, { following: feed === 'following' });
        setReels((prev) => (nextPage === 1 ? data.reels : [...prev, ...data.reels]));
        setHasMore(!!data.hasMore && data.reels.length > 0);
        setPage(nextPage);
      } catch {
        if (nextPage === 1) setReels([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [feed, sort]
  );

  useEffect(() => {
    setLoading(true);
    setActive(0);
    load(1);
  }, [load]);

  // Restore the mute choice, matching the website's persisted setting.
  useEffect(() => {
    AsyncStorage.getItem(MUTED_KEY)
      .then((value) => {
        if (value === '1') setMuted(true);
        if (value === '0') setMuted(false);
      })
      .catch(() => {});
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      AsyncStorage.setItem(MUTED_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  const reelsRef = useRef<Reel[]>([]);
  reelsRef.current = reels;
  const viewedRef = useRef<Set<string>>(new Set());

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      const index = viewableItems[0].index ?? 0;
      setActive(index);
      const reel = reelsRef.current[index];
      if (reel && !viewedRef.current.has(reel.id)) {
        viewedRef.current.add(reel.id);
        api.fun.viewReel(reel.id);
      }
    }
  }).current;

  const toggleFollow = async (reel: Reel) => {
    const userId = reel.user?.id;
    if (!userId || followBusy) return;
    const loggedIn = await api.auth.isLoggedIn();
    if (!loggedIn) {
      Alert.alert('Sign in required', 'Log in to follow creators.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    const current = follows[userId] ?? !!reel.user.followedByMe;
    const next = !current;
    setFollows((prev) => ({ ...prev, [userId]: next }));
    setFollowBusy(userId);
    try {
      await api.fun.toggleFollow(userId, next);
      showToast(next ? `Following @${reel.user.username}` : `Unfollowed @${reel.user.username}`);
    } catch {
      setFollows((prev) => ({ ...prev, [userId]: current }));
      showToast('Could not update follow. Try again.');
    } finally {
      setFollowBusy(null);
    }
  };

  const onVideoMessage = (reelId: string, event: any) => {
    try {
      const data = JSON.parse(event?.nativeEvent?.data || '{}');
      if (data?.type === 'progress' && typeof data.pct === 'number') {
        setProgress((prev) => ({ ...prev, [reelId]: data.pct }));
      }
    } catch {
      /* ignore malformed messages */
    }
  };

  const toggleLike = async (reel: Reel) => {
    const loggedIn = await api.auth.isLoggedIn();
    if (!loggedIn) {
      Alert.alert('Sign in required', 'Log in to like reels and support creators.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    const liked = likes[reel.id] ?? reel.likedByMe;
    setLikes((prev) => ({ ...prev, [reel.id]: !liked }));
    try {
      await api.fun.likeReel(reel.id);
    } catch {
      setLikes((prev) => ({ ...prev, [reel.id]: liked }));
      showToast('Could not save that like. Try again.');
    }
  };

  const handleDoubleTap = (reel: Reel) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Trigger like
      const liked = likes[reel.id] ?? reel.likedByMe;
      if (!liked) toggleLike(reel);

      // Trigger center heart animation
      setShowCenterHeart(true);
      centerHeartAnim.setValue(0);
      Animated.sequence([
        Animated.spring(centerHeartAnim, { toValue: 1.2, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.timing(centerHeartAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setShowCenterHeart(false));
    }
    lastTapRef.current = now;
  };

  const handleShare = async (reel: Reel) => {
    try {
      const url = `https://zyverse.in/reels/${reel.id}`;
      await Share.share({
        message: `Watch this anime reel on ZyniVerse: ${reel.caption || reel.animeTitle || 'Epic anime clip'} ${url}`,
        url,
      });
    } catch {
      showToast('Could not open the share sheet.');
    }
  };

  const handleOpenComments = async (reel: Reel) => {
    setActiveReelForComments(reel);
    setCommentsModal(true);
    setLoadingComments(true);
    try {
      const res = await (api.fun as any).reelComments(reel.id);
      setComments(res?.comments || []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !activeReelForComments) return;
    const loggedIn = await api.auth.isLoggedIn();
    if (!loggedIn) {
      Alert.alert('Sign in required', 'Log in to post a comment.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => { setCommentsModal(false); navigation.navigate('Login'); } },
      ]);
      return;
    }

    setPostingComment(true);
    try {
      const res = await (api.fun as any).postReelComment(activeReelForComments.id, commentText.trim());
      if (res?.comment) {
        setComments((prev) => [res.comment, ...prev]);
      }
      setCommentText('');
    } catch {
      Alert.alert('Error', 'Could not post comment. Please try again.');
    } finally {
      setPostingComment(false);
    }
  };

  const handleOpenReport = (reel: Reel) => {
    setActiveReelForReport(reel);
    setReportModal(true);
  };

  const handleSendReport = async (reason: string) => {
    if (!activeReelForReport) return;
    const loggedIn = await api.auth.isLoggedIn();
    if (!loggedIn) {
      Alert.alert('Sign in required', 'Log in to report content.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => { setReportModal(false); navigation.navigate('Login'); } },
      ]);
      return;
    }
    setReporting(true);
    try {
      await (api.fun as any).reportReel(activeReelForReport.id, reason);
      Alert.alert('Report Received', 'Thank you. Our moderation team will review this clip within 24 hours.');
      setReportModal(false);
    } finally {
      setReporting(false);
    }
  };

  const handleOpenUpload = async () => {
    const loggedIn = await api.auth.isLoggedIn();
    if (!loggedIn) {
      Alert.alert('Sign in required', 'You need to be logged in to upload reels.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setUploadModal(true);
  };

  const handleUploadSubmit = async () => {
    if (!uploadVideoUrl.trim()) {
      Alert.alert('Missing Video URL', 'Please enter a direct video link (mp4/webm).');
      return;
    }
    if (!/^https?:\/\//i.test(uploadVideoUrl.trim())) {
      Alert.alert('Invalid URL', 'Video URL must start with http:// or https://');
      return;
    }
    setUploading(true);
    try {
      await (api.fun as any).postReel({
        videoUrl: uploadVideoUrl.trim(),
        thumbnailUrl: uploadThumbUrl.trim() || undefined,
        caption: uploadCaption.trim() || undefined,
        animeTitle: uploadAnimeTitle.trim() || undefined,
      });
      Alert.alert('Reel Published!', 'Your reel has been shared with the community.');
      setUploadModal(false);
      setUploadVideoUrl('');
      setUploadThumbUrl('');
      setUploadCaption('');
      setUploadAnimeTitle('');
      load(1);
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Could not post reel. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderItem = ({ item, index }: { item: Reel; index: number }) => {
    const isActive = index === active;
    const liked = likes[item.id] ?? item.likedByMe;
    return (
      <View style={{ height: containerHeight, width: '100%', backgroundColor: '#000', overflow: 'hidden' }}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}

        {isActive && item.videoUrl ? (
          <WebView
            key={`${item.id}-${muted ? 'm' : 's'}`}
            source={{ html: videoHtml(item.videoUrl, muted) }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            scrollEnabled={false}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            androidLayerType="hardware"
            onMessage={(event) => onVideoMessage(item.id, event)}
            renderLoading={() => <View style={StyleSheet.absoluteFill} />}
          />
        ) : null}

        {/* Playback progress (same affordance as the website player) */}
        <View pointerEvents="none" style={[styles.progressTrack, { top: insets.top + 46 }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: tint, width: `${Math.min(100, Math.max(0, progress[item.id] || 0))}%` },
            ]}
          />
        </View>

        {/* Double-tap overlay target */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => handleDoubleTap(item)}
        />

        {/* Center Double-Tap Pop Heart */}
        {showCenterHeart && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centerHeart,
              {
                transform: [{ scale: centerHeartAnim }],
                opacity: centerHeartAnim.interpolate({ inputRange: [0, 1, 1.2], outputRange: [0, 1, 0.9] }),
              },
            ]}
          >
            <Text style={{ fontSize: 90 }}>❤️</Text>
          </Animated.View>
        )}

        {/* Side action buttons (Like, Comments, Share, Report) */}
        <View style={[styles.actions, { bottom: insets.bottom + 90 }]}>
          {/* Like */}
          <PressableScale style={styles.actionBtn} onPress={() => toggleLike(item)}>
            <HeartBurst on={liked} />
            <Text style={styles.actionLabel}>
              {(item.likesCount || 0) + (liked && !item.likedByMe ? 1 : !liked && item.likedByMe ? -1 : 0)}
            </Text>
          </PressableScale>

          {/* Comments */}
          <PressableScale style={styles.actionBtn} onPress={() => handleOpenComments(item)}>
            <Text style={{ fontSize: 24 }}>💬</Text>
            <Text style={styles.actionLabel}>{item.commentsCount || 0}</Text>
          </PressableScale>

          {/* Share */}
          <PressableScale style={styles.actionBtn} onPress={() => handleShare(item)}>
            <Text style={{ fontSize: 22 }}>↗️</Text>
            <Text style={styles.actionLabel}>Share</Text>
          </PressableScale>

          {/* Report */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenReport(item)}>
            <Text style={{ fontSize: 18, opacity: 0.8 }}>🚩</Text>
            <Text style={[styles.actionLabel, { opacity: 0.8 }]}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom info */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.userRow}>
            {item.user?.avatar ? (
              <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tint }]}>
                <Text style={{ color: '#0b0b10', fontWeight: '900' }}>
                  {item.user?.username?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.username} numberOfLines={1}>
              @{item.user?.username || 'user'}
            </Text>
            {(() => {
              const uid = item.user?.id;
              const isFollowing = uid ? follows[uid] ?? !!item.user.followedByMe : false;
              if (!uid) return null;
              return (
                <TouchableOpacity
                  onPress={() => toggleFollow(item)}
                  disabled={followBusy === uid}
                  style={[
                    styles.followBtn,
                    isFollowing
                      ? { borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(0,0,0,0.35)' }
                      : { borderColor: tint, backgroundColor: tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.followText,
                      { color: isFollowing ? '#fff' : '#0b0b10' },
                    ]}
                  >
                    {followBusy === uid ? '…' : isFollowing ? 'Following' : '+ Follow'}
                  </Text>
                </TouchableOpacity>
              );
            })()}
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>👁 {formatCount(item.views || 0)}</Text>
            </View>
          </View>

          {!!item.caption && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCaptionOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
            >
              <Text style={styles.caption} numberOfLines={captionOpen[item.id] ? undefined : 2}>
                {item.caption}
              </Text>
              {(item.caption?.length || 0) > 80 && (
                <Text style={styles.captionMore}>{captionOpen[item.id] ? 'less' : 'more'}</Text>
              )}
            </TouchableOpacity>
          )}

          {!!item.animeTitle && (
            <PressableScale
              style={styles.animeChip}
              onPress={() =>
                item.animeId
                  ? navigation.navigate('AnimeDetail', { id: item.animeId, title: item.animeTitle })
                  : undefined
              }
            >
              <Text style={styles.animeChipText} numberOfLines={1}>
                🎬 {item.animeTitle}
              </Text>
            </PressableScale>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && Math.abs(h - measuredHeight) > 2) setMeasuredHeight(h);
      }}
    >
      {/* Fixed top bar: feed switch, sort, upload, mute */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          accessibilityLabel="Back"
        >
          <Text style={styles.iconText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.feedSwitch}>
          {(
            [
              { key: 'foryou', label: 'For You' },
              { key: 'following', label: 'Following' },
            ] as const
          ).map((t) => {
            const on = feed === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setFeed(t.key)}
                style={[styles.feedTab, on && { backgroundColor: 'rgba(255,255,255,0.18)' }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.feedTabText, { color: on ? '#fff' : 'rgba(255,255,255,0.62)' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={() => setSort((s) => (s === 'newest' ? 'popular' : 'newest'))}
            style={styles.iconBtn}
            accessibilityLabel="Change sort"
          >
            <Text style={{ fontSize: 14 }}>{sort === 'newest' ? '🕒' : '🔥'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleOpenUpload}
            style={[styles.uploadPill, { backgroundColor: tint }]}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadPillText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleMuted}
            style={styles.iconBtn}
            accessibilityLabel={muted ? 'Unmute' : 'Mute'}
          >
            <Text style={{ fontSize: 15 }}>{muted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tint} size="large" />
          <Text style={styles.loadingText}>Loading reels…</Text>
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 44 }}>{feed === 'following' ? '👥' : '🎬'}</Text>
          <Text style={styles.emptyTitle}>
            {feed === 'following' ? 'No reels from people you follow' : 'No reels yet'}
          </Text>
          <Text style={styles.emptyText}>
            {feed === 'following'
              ? 'Follow creators and their newest clips will show up here.'
              : 'Be the first to post a clip on ZyniVerse'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: tint }]}
            onPress={() => {
              if (feed === 'following') {
                setFeed('foryou');
              } else {
                handleOpenUpload();
              }
            }}
          >
            <Text style={styles.emptyBtnText}>
              {feed === 'following' ? 'Browse For You' : '+ Upload First Reel'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewRef}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          getItemLayout={(_, index) => ({ length: containerHeight, offset: containerHeight * index, index })}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          onEndReached={() => {
            if (hasMore) load(page + 1);
          }}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(1);
              }}
              tintColor={tint}
            />
          }
        />
      )}

      {/* Lightweight toast (replaces Alert spam for transient errors) */}
      {toast ? (
        <View pointerEvents="none" style={[styles.toastWrap, { bottom: insets.bottom + 120 }]}>
          <Toast key={toast} text={toast} tint={tint} />
        </View>
      ) : null}

      {/* Comments Bottom Sheet Modal */}
      <Modal
        visible={commentsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setCommentsModal(false)}
          />
          <View style={[styles.sheetContent, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentsModal(false)} style={styles.closeBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={tint} />
              </View>
            ) : comments.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 28 }}>💬</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>No comments yet. Say something!</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320, paddingHorizontal: 16 }}>
                {comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <View style={[styles.avatar, styles.avatarFallback, { width: 28, height: 28, backgroundColor: tint }]}>
                      <Text style={{ color: '#0b0b10', fontWeight: '800', fontSize: 11 }}>
                        {c.user?.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>@{c.user?.username}</Text>
                        <Text style={{ color: colors.textDim, fontSize: 10 }}>{timeAgo(c.createdAt)}</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{c.content}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Comment Input */}
            <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Add a comment…"
                placeholderTextColor={colors.textDim}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: tint }, postingComment && { opacity: 0.6 }]}
                onPress={handlePostComment}
                disabled={postingComment}
              >
                {postingComment ? (
                  <ActivityIndicator color="#0b0b10" size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportModal}
        animationType="fade"
        transparent
        onRequestClose={() => setReportModal(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setReportModal(false)} />
          <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Report this Reel</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 14 }}>
              Select a reason to help keep ZyniVerse safe:
            </Text>
            {['Inappropriate or NSFW content', 'Spam or misleading', 'Copyright infringement', 'Violence or hate speech'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reportOption, { borderColor: colors.border }]}
                onPress={() => handleSendReport(r)}
                disabled={reporting}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{r}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelReportBtn} onPress={() => setReportModal(false)}>
              <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upload Reel Modal */}
      <Modal
        visible={uploadModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUploadModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalWrap, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Upload Anime Reel</Text>
            <TouchableOpacity onPress={() => setUploadModal(false)} style={styles.modalCloseBtn}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Video URL *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="https://example.com/clip.mp4"
              placeholderTextColor={colors.textDim}
              value={uploadVideoUrl}
              onChangeText={setUploadVideoUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Thumbnail URL (optional)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="https://example.com/thumb.jpg"
              placeholderTextColor={colors.textDim}
              value={uploadThumbUrl}
              onChangeText={setUploadThumbUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Anime Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Jujutsu Kaisen"
              placeholderTextColor={colors.textDim}
              value={uploadAnimeTitle}
              onChangeText={setUploadAnimeTitle}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Caption</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Write an awesome caption... #anime #edit"
              placeholderTextColor={colors.textDim}
              value={uploadCaption}
              onChangeText={setUploadCaption}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.publishBtn, { backgroundColor: tint }, uploading && { opacity: 0.6 }]}
              onPress={handleUploadSubmit}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <ActivityIndicator color="#0b0b10" size="small" />
              ) : (
                <Text style={styles.publishBtnText}>Publish Reel</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerHeart: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -45,
    marginTop: -45,
    zIndex: 25,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 30,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  topTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  uploadPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPillText: {
    color: '#08090f',
    fontSize: 12,
    fontWeight: '900',
  },
  actions: {
    position: 'absolute',
    right: 12,
    gap: 18,
    alignItems: 'center',
    zIndex: 10,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 76,
    bottom: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durationPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  caption: {
    color: '#f8fafc',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  animeChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  animeChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingText: { color: '#94a3b8', fontSize: 12 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  emptyBtn: { marginTop: 12, borderRadius: borderRadius.md, paddingHorizontal: 18, paddingVertical: 11 },
  emptyBtnText: { color: '#0b0b10', fontSize: 13, fontWeight: '900' },
  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalCloseBtn: { padding: 4 },
  modalBody: { padding: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
  modalInput: {
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  modalTextArea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  publishBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  publishBtnText: { color: '#08090f', fontSize: 15, fontWeight: '900' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  closeBtn: { padding: 4 },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#08090f', fontSize: 13, fontWeight: '900' },
  reportCard: {
    margin: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    alignSelf: 'center',
    width: '90%',
  },
  reportOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  cancelReportBtn: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
  },
  progressTrack: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    zIndex: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  followBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    marginLeft: 2,
  },
  followText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  captionMore: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  feedSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  feedTab: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  feedTabText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    maxWidth: '86%',
  },
  toastText: {
    color: '#0b0b10',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
});
