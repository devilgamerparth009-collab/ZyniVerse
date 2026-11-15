import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
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
import { spacing, borderRadius } from '../theme';
import { timeAgo, defaultAvatarFor } from '../utils/helpers';

const REACTIONS = ['❤️', '🔥', '😂', '👏', '😮', '🎉'];

function Avatar({ uri, name, size = 30 }: { uri?: string | null; name?: string | null; size?: number }) {
  return (
    <Image
      source={{ uri: uri || defaultAvatarFor(name) }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1a1a2e' }}
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
  const { colors, isDiwali, isChristmas } = useTheme();
  const tint = isDiwali ? '#f59e0b' : isChristmas ? '#7dd3fc' : colors.primary;

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

  const isHost = !!user && !!party && user.id === party.hostId;
  const status = statusMeta(party?.status);
  const cover = party?.coverImage || party?.mediaImage;

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
        <View style={styles.center}>
          <ActivityIndicator color={tint} />
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
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={refreshAll}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
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
            <View style={[styles.hero, { borderColor: `${status.color}55`, backgroundColor: colors.surface }]}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={[styles.heroImage, { backgroundColor: colors.surfaceLight }]} />
              )}
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
                  <Avatar uri={party.host?.avatar} name={party.host?.username} size={24} />
                  <Text style={styles.hostName} numberOfLines={1}>
                    Hosted by {party.host?.username || 'a fan'}
                  </Text>
                  <Text style={styles.hostDot}>•</Text>
                  <Text style={styles.hostName}>{timeAgo(party.createdAt)}</Text>
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
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: tint, flex: 1 }]}
                      onPress={() => setVideoOpen(true)}
                    >
                      <Text style={styles.primaryBtnText}>▶ Open player</Text>
                    </TouchableOpacity>
                    {isHost && (
                      <TouchableOpacity
                        style={[styles.ghostBtn, { borderColor: colors.border }]}
                        onPress={() => {
                          setVideoDraft(party.videoUrl || '');
                          setVideoEditor(true);
                        }}
                      >
                        <Text style={[styles.ghostBtnText, { color: colors.textMuted }]}>Change</Text>
                      </TouchableOpacity>
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
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: tint, marginTop: 10 }]}
                      onPress={() => setVideoEditor(true)}
                    >
                      <Text style={styles.primaryBtnText}>＋ Add video source</Text>
                    </TouchableOpacity>
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
                  <TouchableOpacity
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
                  </TouchableOpacity>
                  <TouchableOpacity
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
                  </TouchableOpacity>
                </View>

                <View style={styles.stepperRow}>
                  <Text style={[styles.stepperLabel, { color: colors.textMuted }]}>Episode</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => stepEpisode(-1)}
                      style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Text style={[styles.stepBtnText, { color: colors.text }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepValue, { color: colors.text }]}>{party.episode}</Text>
                    <TouchableOpacity
                      onPress={() => stepEpisode(1)}
                      style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Text style={[styles.stepBtnText, { color: colors.text }]}>＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {!!party.videoUrl && (
                  <TouchableOpacity
                    onPress={togglePlayback}
                    style={[styles.ghostBtn, { borderColor: `${tint}55`, marginTop: 10, alignSelf: 'flex-start' }]}
                  >
                    <Text style={[styles.ghostBtnText, { color: tint }]}>
                      {sync?.isPlaying ? '⏸ Sync pause' : '▶ Sync play'}
                    </Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => react(emoji)}
                    style={[styles.reactionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                  >
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity
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
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: tint, marginTop: 10 }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.primaryBtnText}>Sign in to chat</Text>
                </TouchableOpacity>
              )}
            </View>
          </FadeInView>

          <TouchableOpacity onPress={leave} style={[styles.leaveBtn, { borderColor: `${colors.error}66` }]}>
            <Text style={[styles.leaveText, { color: colors.error }]}>Leave party</Text>
          </TouchableOpacity>
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
            <TouchableOpacity
              disabled={!videoDraft.trim() || busy === 'video'}
              onPress={saveVideo}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: videoDraft.trim() ? tint : colors.surfaceLight,
                  marginTop: 12,
                },
              ]}
            >
              <Text style={[styles.primaryBtnText, { color: videoDraft.trim() ? '#0a0a0f' : colors.textDim }]}>
                {busy === 'video' ? 'Saving…' : 'Save source'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 30 },
  centerTitle: { fontSize: 17, fontWeight: '900' },
  centerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  hero: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    height: 196,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,6,13,0.55)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  episodePill: {
    backgroundColor: 'rgba(5,6,13,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  episodePillText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  heroBottom: { padding: 12 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '900', lineHeight: 24 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  hostName: { color: 'rgba(255,255,255,0.8)', fontSize: 10.5, maxWidth: 160 },
  hostDot: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
  syncStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.md },
  syncCell: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 8, paddingHorizontal: 8 },
  syncLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  syncValue: { fontSize: 12, fontWeight: '900', marginTop: 3 },
  section: { marginTop: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  sectionMeta: { fontSize: 10 },
  memberScroll: { paddingHorizontal: spacing.md, gap: 12 },
  memberCard: { alignItems: 'center', width: 58 },
  memberRing: { borderWidth: 2, borderRadius: 24, padding: 2 },
  memberName: { fontSize: 9.5, marginTop: 4, maxWidth: 56 },
  memberBadge: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6, marginTop: 1 },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardBody: { fontSize: 11.5, lineHeight: 17 },
  tagPill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  rowGap: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryBtn: { borderRadius: borderRadius.md, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  primaryBtnText: { color: '#0a0a0f', fontSize: 12, fontWeight: '900' },
  ghostBtn: { borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  ghostBtnText: { fontSize: 11, fontWeight: '800' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  stepperLabel: { fontSize: 12, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 16, fontWeight: '900' },
  stepValue: { fontSize: 15, fontWeight: '900', minWidth: 26, textAlign: 'center' },
  errorText: { fontSize: 11, marginTop: 8 },
  reactionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reactionBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chatList: { marginTop: 4, gap: 10 },
  chatEmpty: { fontSize: 11.5, paddingVertical: 10, textAlign: 'center' },
  msgRow: { flexDirection: 'row', gap: 8 },
  msgRowMine: { opacity: 1 },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  msgName: { fontSize: 10.5, fontWeight: '800', flexShrink: 1 },
  msgTime: { fontSize: 8.5 },
  msgText: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  composerInput: { flex: 1, fontSize: 12.5, paddingVertical: 4, maxHeight: 80 },
  sendBtn: { borderRadius: borderRadius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  sendText: { fontSize: 11, fontWeight: '900' },
  leaveBtn: { marginTop: spacing.lg, marginHorizontal: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 11, alignItems: 'center' },
  leaveText: { fontSize: 12, fontWeight: '800' },
  floaterLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  playerWrap: { flex: 1, backgroundColor: '#000' },
  playerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
  playerTitle: { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1, marginRight: 10 },
  playerClose: { color: '#fff', fontSize: 18, fontWeight: '900' },
  editorWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  editorSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.md, paddingBottom: 26 },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  urlInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, fontSize: 12.5 },
});
