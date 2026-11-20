import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { User, WatchParty, WatchPartyMessage, WatchPartySyncState } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import SafeImage from '../components/SafeImage';
import { SkeletonBlock } from '../components/Skeletons';
import { spacing, borderRadius } from '../theme';
import { timeAgo } from '../utils/helpers';

const REACTIONS = ['❤️', '🔥', '😂', '👏', '😮', '🎉'];

function Avatar({ uri, name, size = 30 }: { uri?: string | null; name?: string | null; size?: number }) {
  const label = name || 'Fan';
  return (
    <SafeImage
      uri={uri}
      fallbackLabel={label}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1a1a2e',
      }}
    />
  );
}

function clock(seconds?: number | null): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function statusMeta(status?: string) {
  if (status === 'live') return { label: 'LIVE', color: '#ef4444' };
  if (status === 'ended') return { label: 'ENDED', color: '#64748b' };
  return { label: 'WAITING', color: '#f59e0b' };
}

/** Player markup. HLS needs hls.js; plain files play natively in the tag. */
function buildVideoHtml(rawUrl: string): string {
  const url = rawUrl.trim();
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) {
    return `<!doctype html><html><body style="margin:0;background:#000">
      <iframe width="100%" height="100%" style="border:0"
        src="https://www.youtube.com/embed/${yt[1]}?autoplay=1&playsinline=1"
        allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    </body></html>`;
  }
  const safe = JSON.stringify(url);
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain}</style>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"></script>
  </head><body>
    <video id="v" controls autoplay playsinline></video>
    <script>
      var src = ${safe};
      var v = document.getElementById('v');
      if (src.indexOf('.m3u8') !== -1 && window.Hls && window.Hls.isSupported()) {
        var hls = new window.Hls();
        hls.loadSource(src);
        hls.attachMedia(v);
        v.play().catch(function(){});
      } else {
        v.src = src;
        v.play().catch(function(){});
      }
    </script>
  </body></html>`;
}

/* Local floating emoji — reactions are a room vibe, not stored state. */
function FloatingEmoji({ emoji, x, onDone }: { emoji: string; x: number; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(onDone);
  }, [t, onDone]);
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 0,
        left: x,
        fontSize: 26,
        opacity: t.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -180] }) },
          { scale: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 1.15, 0.9] }) },
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

export default function WatchPartyRoomScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const partyId: string = route?.params?.id;
  const { colors, isLaunch, isChristmas } = useTheme();
  const tint = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : colors.primary;

  const [party, setParty] = useState<WatchParty | null>(null);
  const [sync, setSync] = useState<WatchPartySyncState | null>(null);
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoEditor, setVideoEditor] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const floaterId = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);
  const heroPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroPulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heroPulse]);

  const isHost = !!user && !!party && user.id === party.hostId;
  const status = statusMeta(party?.status);
  const cover = party?.coverImage || party?.mediaImage;
  const heroGlowStyle = {
    opacity: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
    transform: [
      { scale: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  };

  const loadParty = useCallback(async () => {
    try {
      const data = await api.watchParty.get(partyId);
      if (!mountedRef.current) return;
      setParty(data);
      setSync({
        isPlaying: data.isPlaying,
        playbackPos: data.playbackPos,
        episode: data.episode,
        status: data.status,
        lastSyncAt: data.lastSyncAt,
      });
      setError(null);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || 'Could not load this room');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [partyId]);

  const loadMessages = useCallback(async () => {
    try {
      const rows = await api.watchParty.messages(partyId);
      if (mountedRef.current) setMessages(rows);
    } catch {
      // Chat is best-effort; a failed poll must not blank the room.
    }
  }, [partyId]);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const current = await getCurrentUser().catch(() => null);
      if (mountedRef.current) setUser(current);
      if (current) {
        try {
          await api.watchParty.join(partyId);
          joinedRef.current = true;
        } catch {}
      }
      await loadParty();
      await loadMessages();
    })();

    const syncTimer = setInterval(() => {
      api.watchParty
        .sync(partyId)
        .then((s) => {
          if (mountedRef.current) {
            setSync(s);
            setParty((prev) =>
              prev
                ? { ...prev, episode: s.episode, status: s.status, isPlaying: s.isPlaying, playbackPos: s.playbackPos, lastSyncAt: s.lastSyncAt }
                : prev
            );
          }
        })
        .catch(() => {});
    }, 10000);

    const chatTimer = setInterval(() => {
      loadMessages();
    }, 6000);

    return () => {
      mountedRef.current = false;
      clearInterval(syncTimer);
      clearInterval(chatTimer);
      // Leave silently so the member list stays accurate, but never yank the
      // host out of their own room.
      if (joinedRef.current) api.watchParty.leave(partyId).catch(() => {});
    };
  }, [partyId, loadParty, loadMessages]);

  const refreshAll = async () => {
    await Promise.all([loadParty(), loadMessages()]);
  };

  const runAction = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    setActionError(null);
    try {
      const updated = await fn();
      if (updated) {
        setParty(updated);
        setSync({
          isPlaying: updated.isPlaying,
          playbackPos: updated.playbackPos,
          episode: updated.episode,
          status: updated.status,
          lastSyncAt: updated.lastSyncAt,
        });
      }
      await loadParty();
    } catch (e: any) {
      setActionError(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const startParty = () => runAction('start', () => api.watchParty.update(partyId, { action: 'start' }));
  const endParty = () => runAction('end', () => api.watchParty.update(partyId, { action: 'end' }));
  const stepEpisode = (delta: number) => {
    const next = Math.max(1, (party?.episode || 1) + delta);
    if (next === party?.episode) return;
    runAction('episode', () => api.watchParty.update(partyId, { episode: next }));
  };
  const togglePlayback = () =>
    runAction('playback', () =>
      api.watchParty.update(partyId, {
        isPlaying: !(sync?.isPlaying ?? false),
        playbackPos: sync?.playbackPos || 0,
      })
    );
  const saveVideo = async () => {
    const url = videoDraft.trim();
    if (!url) return;
    await runAction('video', () => api.watchParty.update(partyId, { videoUrl: url, videoType: 'external' }));
    setVideoEditor(false);
    setVideoDraft('');
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.watchParty.send(partyId, text);
      await loadMessages();
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (e: any) {
      setActionError(e?.message || 'Message not sent');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const react = (emoji: string) => {
    const id = floaterId.current++;
    setFloaters((prev) => [...prev, { id, emoji, x: 20 + (id * 37) % 220 }]);
  };

  const leave = async () => {
    try {
      await api.watchParty.leave(partyId);
    } catch {}
    joinedRef.current = false;
    navigation.goBack();
  };

  const memberCount = party?.members?.length || 0;
  const headerSub = useMemo(() => {
    if (!party) return 'Loading room…';
    return `${status.label} · Episode ${party.episode} · ${memberCount} watching`;
  }, [party, status.label, memberCount]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Watch Party" subtitle="Joining the room…" emoji="👥" accent={tint} />
        <View style={styles.roomSkeleton}>
          <SkeletonBlock height={196} radius={borderRadius.lg} />
          <View style={styles.skeletonStats}>
            {[0, 1, 2, 3].map((item) => (
              <SkeletonBlock key={item} height={48} radius={borderRadius.md} style={styles.skeletonStat} />
            ))}
          </View>
          <SkeletonBlock height={120} radius={borderRadius.lg} style={styles.skeletonBlock} />
          <SkeletonBlock height={170} radius={borderRadius.lg} style={styles.skeletonBlock} />
        </View>
      </View>
    );
  }

  if (error || !party) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Watch Party" subtitle="Room unavailable" emoji="👥" accent={tint} />
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>🚫</Text>
          <Text style={[styles.centerTitle, { color: colors.text }]}>Room not found</Text>
          <Text style={[styles.centerText, { color: colors.textMuted }]}>{error}</Text>
          <PressableScale
            scaleTo={0.94}
            style={[styles.primaryBtn, { backgroundColor: tint }]}
            onPress={refreshAll}
          >
            <Text style={styles.primaryBtnText}>Retry</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={party.mediaTitle} subtitle={headerSub} emoji="🍿" accent={tint} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <FadeInView delay={20}>
            <View style={styles.heroWrap}>
              <Animated.View
                pointerEvents="none"
                style={[styles.heroGlow, { backgroundColor: `${status.color}26` }, heroGlowStyle]}
              />
              <View style={[styles.hero, { borderColor: `${status.color}66`, backgroundColor: colors.surface }]}>
                <SafeImage
                  uri={cover}
                  fallbackLabel={party.mediaTitle}
                  style={styles.heroImage}
                  accessibilityLabel={party.mediaTitle}
                />
                <View style={styles.heroScrim} />
                <View style={styles.heroTop}>
                  <View style={[styles.statusPill, { backgroundColor: status.color }]}>
                    {party.status === 'live' && <View style={styles.liveDot} />}
                    <Text style={styles.statusText}>{status.label}</Text>
                  </View>
                  <View style={styles.episodePill}>
                    <Text style={styles.episodePillText}>EP {party.episode}</Text>
                  </View>
                </View>
                <View style={styles.heroBottom}>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {party.mediaTitle}
                  </Text>
                  <View style={styles.hostRow}>
                    <Avatar uri={party.host?.avatar} name={party.host?.username} size={26} />
                    <Text style={styles.hostName} numberOfLines={1}>
                      Hosted by {party.host?.username || 'a fan'}
                    </Text>
                    <Text style={styles.hostDot}>•</Text>
                    <Text style={styles.hostName}>{timeAgo(party.createdAt)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </FadeInView>

          {/* Sync strip */}
          <FadeInView delay={60}>
            <View style={styles.syncStrip}>
              {[
                {
                  label: 'PLAYBACK',
                  value: sync?.isPlaying ? 'PLAYING' : 'PAUSED',
                  color: sync?.isPlaying ? '#22c55e' : '#f59e0b',
                },
                { label: 'POSITION', value: clock(sync?.playbackPos), color: colors.text },
                { label: 'EPISODE', value: `#${sync?.episode ?? party.episode}`, color: tint },
                {
                  label: 'SYNCED',
                  value: sync?.lastSyncAt ? timeAgo(sync.lastSyncAt) : '—',
                  color: colors.textMuted,
                },
              ].map((stat) => (
                <View key={stat.label} style={[styles.syncCell, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Text style={[styles.syncLabel, { color: colors.textDim }]}>{stat.label}</Text>
                  <Text style={[styles.syncValue, { color: stat.color }]} numberOfLines={1}>
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          </FadeInView>

          {/* Members */}
          <FadeInView delay={90}>
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>In the room</Text>
                <Text style={[styles.sectionMeta, { color: colors.textDim }]}>{memberCount} watching</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberScroll}>
                {(party.members || []).map((m) => (
                  <View key={m.id} style={styles.memberCard}>
                    <View style={[styles.memberRing, { borderColor: m.role === 'host' ? tint : colors.border }]}>
                      <Avatar uri={m.user?.avatar} name={m.user?.username} size={40} />
                    </View>
                    <Text style={[styles.memberName, { color: colors.textMuted }]} numberOfLines={1}>
                      {m.user?.username || 'Fan'}
                    </Text>
                    {m.role === 'host' && <Text style={[styles.memberBadge, { color: tint }]}>HOST</Text>}
                  </View>
                ))}
                {memberCount === 0 && (
                  <Text style={[styles.memberName, { color: colors.textDim }]}>Nobody here yet — invite a friend.</Text>
                )}
              </ScrollView>
            </View>
          </FadeInView>

          {/* Video source */}
          <FadeInView delay={120}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Watch together</Text>
                {!!party.videoUrl && (
                  <View style={[styles.tagPill, { borderColor: `${tint}55`, backgroundColor: `${tint}14` }]}>
                    <Text style={[styles.tagText, { color: tint }]}>{party.videoType || 'video'}</Text>
                  </View>
                )}
              </View>

              {party.videoUrl ? (
                <>
                  <Text style={[styles.cardBody, { color: colors.textMuted }]} numberOfLines={1}>
                    {party.videoUrl}
                  </Text>
                  <View style={styles.rowGap}>
                    <PressableScale
                      scaleTo={0.95}
                      style={[styles.primaryBtn, { backgroundColor: tint, flex: 1 }]}
                      onPress={() => setVideoOpen(true)}
                    >
                      <Text style={styles.primaryBtnText}>▶ Open player</Text>
                    </PressableScale>
                    {isHost && (
                      <PressableScale
                        scaleTo={0.94}
                        style={[styles.ghostBtn, { borderColor: colors.border }]}
                        onPress={() => {
                          setVideoDraft(party.videoUrl || '');
                          setVideoEditor(true);
                        }}
                      >
                        <Text style={[styles.ghostBtnText, { color: colors.textMuted }]}>Change</Text>
                      </PressableScale>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.cardBody, { color: colors.textMuted }]}>
                    {isHost
                      ? 'Add a direct video or HLS link. Everyone in the room gets the same player.'
                      : 'The host has not added a video source yet. Chat is open — hang tight.'}
                  </Text>
                  {isHost && (
                    <PressableScale
                      scaleTo={0.94}
                      style={[styles.primaryBtn, { backgroundColor: tint, marginTop: 12 }]}
                      onPress={() => setVideoEditor(true)}
                    >
                      <Text style={styles.primaryBtnText}>＋ Add video source</Text>
                    </PressableScale>
                  )}
                </>
              )}
            </View>
          </FadeInView>

          {/* Host controls */}
          {isHost && (
            <FadeInView delay={150}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${tint}44` }]}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Host controls</Text>
                  <View style={[styles.tagPill, { borderColor: `${tint}55`, backgroundColor: `${tint}14` }]}>
                    <Text style={[styles.tagText, { color: tint }]}>HOST</Text>
                  </View>
                </View>

                <View style={styles.rowGap}>
                  <PressableScale
                    scaleTo={0.95}
                    disabled={party.status === 'live' || busy === 'start'}
                    onPress={startParty}
                    style={[
                      styles.primaryBtn,
                      {
                        flex: 1,
                        backgroundColor: party.status === 'live' ? colors.surfaceLight : '#22c55e',
                      },
                    ]}
                  >
                    <Text style={[styles.primaryBtnText, { color: party.status === 'live' ? colors.textDim : '#052e16' }]}>
                      {busy === 'start' ? 'Starting…' : '▶ Start party'}
                    </Text>
                  </PressableScale>
                  <PressableScale
                    scaleTo={0.95}
                    disabled={party.status === 'ended' || busy === 'end'}
                    onPress={endParty}
                    style={[
                      styles.primaryBtn,
                      { flex: 1, backgroundColor: party.status === 'ended' ? colors.surfaceLight : '#ef4444' },
                    ]}
                  >
                    <Text style={[styles.primaryBtnText, { color: party.status === 'ended' ? colors.textDim : '#fff' }]}>
                      {busy === 'end' ? 'Ending…' : '■ End party'}
                    </Text>
                  </PressableScale>
                </View>

                <View style={styles.stepperRow}>
                  <Text style={[styles.stepperLabel, { color: colors.textMuted }]}>Episode</Text>
                  <View style={styles.stepper}>
                    <PressableScale
                      scaleTo={0.88}
                      onPress={() => stepEpisode(-1)}
                      style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
                    </PressableScale>
                    <Text style={[styles.stepValue, { color: colors.text }]}>{party.episode}</Text>
                    <PressableScale
                      scaleTo={0.88}
                      onPress={() => stepEpisode(1)}
                      style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Text style={[styles.stepBtnText, { color: colors.text }]}>＋</Text>
                    </PressableScale>
                  </View>
                </View>

                {!!party.videoUrl && (
                  <PressableScale
                    scaleTo={0.94}
                    onPress={togglePlayback}
                    style={[styles.ghostBtn, { borderColor: `${tint}55`, marginTop: 12, alignSelf: 'flex-start' }]}
                  >
                    <Text style={[styles.ghostBtnText, { color: tint }]}>
                      {sync?.isPlaying ? '⏸ Sync pause' : '▶ Sync play'}
                    </Text>
                  </PressableScale>
                )}

                {!!actionError && (
                  <Text style={[styles.errorText, { color: colors.error }]}>{actionError}</Text>
                )}
              </View>
            </FadeInView>
          )}

          {/* Reactions */}
          <FadeInView delay={180}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Send a reaction</Text>
              <View style={styles.reactionRow}>
                {REACTIONS.map((emoji) => (
                  <PressableScale
                    key={emoji}
                    scaleTo={0.84}
                    onPress={() => react(emoji)}
                    style={[styles.reactionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          </FadeInView>

          {/* Chat */}
          <FadeInView delay={210}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Room chat</Text>
                <Text style={[styles.sectionMeta, { color: colors.textDim }]}>{messages.length} messages</Text>
              </View>

              <View style={styles.chatList}>
                {messages.length === 0 ? (
                  <Text style={[styles.chatEmpty, { color: colors.textDim }]}>
                    No messages yet. Say hi 👋
                  </Text>
                ) : (
                  messages.map((m) => {
                    const mine = !!user && m.userId === user.id;
                    return (
                      <View key={m.id} style={[styles.msgRow, mine && styles.msgRowMine]}>
                        <Avatar uri={m.avatar} name={m.username} size={24} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.msgHead}>
                            <Text style={[styles.msgName, { color: mine ? tint : colors.textMuted }]} numberOfLines={1}>
                              {mine ? 'You' : m.username}
                            </Text>
                            <Text style={[styles.msgTime, { color: colors.textDim }]}>{timeAgo(m.createdAt)}</Text>
                          </View>
                          <Text style={[styles.msgText, { color: colors.text }]}>{m.message}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {user ? (
                <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Message the room…"
                    placeholderTextColor={colors.textDim}
                    style={[styles.composerInput, { color: colors.text }]}
                    onSubmitEditing={send}
                    returnKeyType="send"
                    maxLength={500}
                  />
                  <PressableScale
                    scaleTo={0.9}
                    onPress={send}
                    disabled={!draft.trim() || sending}
                    style={[
                      styles.sendBtn,
                      { backgroundColor: draft.trim() ? tint : colors.surfaceLight },
                    ]}
                  >
                    <Text style={[styles.sendText, { color: draft.trim() ? '#0a0a0f' : colors.textDim }]}>
                      {sending ? '…' : 'Send'}
                    </Text>
                  </PressableScale>
                </View>
              ) : (
                <PressableScale
                  scaleTo={0.94}
                  style={[styles.primaryBtn, { backgroundColor: tint, marginTop: 12 }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.primaryBtnText}>Sign in to chat</Text>
                </PressableScale>
              )}
            </View>
          </FadeInView>

          <PressableScale
            scaleTo={0.96}
            onPress={leave}
            style={[styles.leaveBtn, { borderColor: `${colors.error}66` }]}
          >
            <Text style={[styles.leaveText, { color: colors.error }]}>Leave party</Text>
          </PressableScale>
        </ScrollView>

        {/* Floating reactions overlay */}
        <View pointerEvents="none" style={styles.floaterLayer}>
          {floaters.map((f) => (
            <FloatingEmoji
              key={f.id}
              emoji={f.emoji}
              x={f.x}
              onDone={() => setFloaters((prev) => prev.filter((x) => x.id !== f.id))}
            />
          ))}
        </View>
      </KeyboardAvoidingView>

      {/* Video player modal */}
      <Modal visible={videoOpen} animationType="fade" onRequestClose={() => setVideoOpen(false)}>
        <View style={styles.playerWrap}>
          <View style={[styles.playerBar, { paddingTop: insets.top + 6, backgroundColor: '#05060d' }]}>
            <Text style={styles.playerTitle} numberOfLines={1}>
              {party.mediaTitle} · EP {party.episode}
            </Text>
            <TouchableOpacity onPress={() => setVideoOpen(false)} hitSlop={12}>
              <Text style={styles.playerClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {party.videoUrl ? (
            <WebView
              source={{ html: buildVideoHtml(party.videoUrl) }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              style={{ flex: 1, backgroundColor: '#000' }}
            />
          ) : null}
        </View>
      </Modal>

      {/* Video source editor */}
      <Modal visible={videoEditor} animationType="slide" transparent onRequestClose={() => setVideoEditor(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editorWrap}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setVideoEditor(false)} />
          <View style={[styles.editorSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Video source</Text>
            <Text style={[styles.cardBody, { color: colors.textMuted, marginTop: 4 }]}>
              Direct MP4, HLS (.m3u8) or a YouTube link. The room player opens it for everyone.
            </Text>
            <TextInput
              value={videoDraft}
              onChangeText={setVideoDraft}
              placeholder="https://…"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.urlInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <PressableScale
              scaleTo={0.96}
              disabled={!videoDraft.trim() || busy === 'video'}
              onPress={saveVideo}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: videoDraft.trim() ? tint : colors.surfaceLight,
                  marginTop: 14,
                },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: videoDraft.trim() ? '#0a0a0f' : colors.textDim }]}>
                {busy === 'video' ? 'Saving…' : 'Save source'}
              </Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10, paddingHorizontal: 30 },
  centerTitle: { fontSize: 18, fontWeight: '900' },
  centerText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  roomSkeleton: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  skeletonStats: { flexDirection: 'row', gap: spacing.sm },
  skeletonStat: { flex: 1 },
  skeletonBlock: { marginTop: spacing.sm },
  heroWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    position: 'relative',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: borderRadius.xl,
  },
  hero: {
    height: 204,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,6,13,0.58)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  episodePill: {
    backgroundColor: 'rgba(5,6,13,0.72)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  episodePillText: { color: '#fff', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 },
  heroBottom: { padding: 16 },
  heroTitle: { color: '#fff', fontSize: 21, fontWeight: '900', lineHeight: 26 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  hostName: { color: 'rgba(255,255,255,0.84)', fontSize: 12, maxWidth: 180 },
  hostDot: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  syncStrip: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  syncCell: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 9 },
  syncLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  syncValue: { fontSize: 13.5, fontWeight: '900', marginTop: 4 },
  section: { marginTop: spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionMeta: { fontSize: 12 },
  memberScroll: { paddingHorizontal: spacing.md, gap: spacing.md },
  memberCard: { alignItems: 'center', width: 66 },
  memberRing: { borderWidth: 2, borderRadius: 26, padding: 3 },
  memberName: { fontSize: 11, marginTop: 6, maxWidth: 62 },
  memberBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 2 },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md + 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardBody: { fontSize: 13, lineHeight: 19 },
  tagPill: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  rowGap: { flexDirection: 'row', gap: spacing.sm, marginTop: 14 },
  primaryBtn: { borderRadius: borderRadius.md, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  primaryBtnText: { color: '#0a0a0f', fontSize: 14, fontWeight: '900' },
  ghostBtn: { borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  ghostBtnText: { fontSize: 13, fontWeight: '800' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md + 2 },
  stepperLabel: { fontSize: 14, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  stepBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 18, fontWeight: '900' },
  stepValue: { fontSize: 17, fontWeight: '900', minWidth: 30, textAlign: 'center' },
  errorText: { fontSize: 12.5, marginTop: spacing.sm },
  reactionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 14 },
  reactionBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chatList: { marginTop: spacing.sm, gap: 12 },
  chatEmpty: { fontSize: 13.5, paddingVertical: 14, textAlign: 'center' },
  msgRow: { flexDirection: 'row', gap: spacing.sm },
  msgRowMine: { opacity: 1 },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  msgName: { fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
  msgTime: { fontSize: 10 },
  msgText: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  composerInput: { flex: 1, fontSize: 14, paddingVertical: 5, maxHeight: 90 },
  sendBtn: { borderRadius: borderRadius.sm, paddingHorizontal: 14, paddingVertical: 9 },
  sendText: { fontSize: 13, fontWeight: '900' },
  leaveBtn: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  leaveText: { fontSize: 14, fontWeight: '800' },
  floaterLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  playerWrap: { flex: 1, backgroundColor: '#000' },
  playerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  playerTitle: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1, marginRight: 12 },
  playerClose: { color: '#fff', fontSize: 20, fontWeight: '900' },
  editorWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  editorSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: spacing.md + 2,
    paddingBottom: 28,
  },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  urlInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14, fontSize: 14 },
});
