import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { LoadingBlock, SignedOutCard } from '../components/social/SocialBits';
import { useSocialAuth } from '../hooks/useSocialAuth';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api, ChatMessage } from '../services/api';

const POLL_MS = 6000;
const REACTIONS = ['👍', '❤️', '🔥', '😂', '😮'];

/** Older chat rows used an array of reaction rows; new rows send a count map. */
function reactionCounts(message: ChatMessage): Record<string, number> {
  const raw = message.reactions;
  if (!raw) return {};
  if (!Array.isArray(raw)) return raw;
  return raw.reduce<Record<string, number>>((counts, reaction) => {
    counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
    return counts;
  }, {});
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { checking, signedIn } = useSocialAuth();

  const initialConversationId: string | undefined = route.params?.conversationId;
  const userId: string | undefined = route.params?.userId;
  const title: string = route.params?.username || 'Chat';

  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<string>(route.params?.initialMessage || '');
  const [error, setError] = useState<string | null>(null);
  const [remoteTyping, setRemoteTyping] = useState<string | null>(null);
  const [expandedReactions, setExpandedReactions] = useState<string | null>(null);
  const [busyMessages, setBusyMessages] = useState<string[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const meRef = useRef<string | null>(null);
  const conversationRef = useRef<string | undefined>(conversationId);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);

  const resolveConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    if (!userId) return undefined;
    const conversation = await api.chat.start(userId);
    if (conversation?.id) {
      setConversationId(conversation.id);
      return conversation.id;
    }
    return undefined;
  }, [conversationId, userId]);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const id = await resolveConversation();
        if (!id) {
          setError('Could not open this conversation.');
          return;
        }
        const result = await api.chatExtras.messagesWithTyping(id, 60);
        setMessages(result.messages);
        if (result.typingUsers.length > 0) setRemoteTyping(result.typingUsers[0]);
        setError(null);
        api.chat.markRead(id).catch(() => {});
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load messages');
      } finally {
        setLoading(false);
      }
    },
    [resolveConversation]
  );

  useEffect(() => {
    if (!checking && signedIn) void load(true);
  }, [checking, signedIn, load]);

  // Light polling keeps the thread fresh without adding a realtime dependency
  // to the APK. Pauses automatically when the screen unmounts.
  useEffect(() => {
    if (!signedIn) return;
    const timer = setInterval(() => {
      void load(false);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, signedIn]);

  useEffect(() => {
    api.auth
      .current()
      .then((u) => {
        meRef.current = u?.id || null;
      })
      .catch(() => {});
  }, []);

  // No DM realtime client ships in the APK yet. If one starts emitting
  // `dm-typing`, this listener shows its bubble immediately; the 6s polling
  // response is the fallback (see load above).
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'dm-typing',
      (event: { conversationId?: string; username?: string; isTyping?: boolean }) => {
        if (!event || event.conversationId !== conversationRef.current) return;
        if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        if (event.isTyping) {
          setRemoteTyping(event.username || 'Someone');
          typingClearTimer.current = setTimeout(() => setRemoteTyping(null), 4000);
        } else {
          setRemoteTyping(null);
        }
      }
    );
    return () => {
      subscription.remove();
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
    };
  }, []);

  const signalTyping = useCallback((isTyping: boolean) => {
    const id = conversationRef.current;
    if (!id) return;
    void api.chatExtras.typing(id, isTyping);
  }, []);

  const clearTypingTimers = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingTimer.current = null;
    typingStopTimer.current = null;
  }, []);

  useEffect(
    () => () => {
      clearTypingTimers();
      const id = conversationRef.current;
      if (id) void api.chatExtras.typing(id, false);
    },
    [clearTypingTimers]
  );

  const onDraftChange = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      clearTypingTimers();
      signalTyping(false);
      return;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingTimer.current = setTimeout(() => signalTyping(true), 250);
    typingStopTimer.current = setTimeout(() => signalTyping(false), 1600);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    clearTypingTimers();
    signalTyping(false);
    setSending(true);
    setDraft('');
    setExpandedReactions(null);
    try {
      const id = await resolveConversation();
      if (!id) throw new Error('Conversation unavailable');
      const message = await api.chat.send(id, content);
      if (message?.id) {
        setMessages((prev) => [...prev, message]);
      } else {
        await load(false);
      }
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e: unknown) {
      setDraft(content);
      setError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const reactToMessage = async (message: ChatMessage, emoji: string) => {
    if (busyMessages.includes(message.id)) return;
    setExpandedReactions(null);
    setBusyMessages((ids) => [...ids, message.id]);
    try {
      const result = await api.chatExtras.react(message.id, emoji);
      setMessages((list) =>
        list.map((m) =>
          m.id === message.id
            ? { ...m, reactions: result.reactions, myReactions: result.myReactions }
            : m
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save reaction');
    } finally {
      setBusyMessages((ids) => ids.filter((id) => id !== message.id));
    }
  };

  const deleteMessage = (message: ChatMessage) => {
    Alert.alert('Delete message', 'Delete this message for everyone in the chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyMessages((ids) => [...ids, message.id]);
          try {
            await api.chatExtras.delete(message.id);
            setMessages((list) =>
              list.map((m) =>
                m.id === message.id ? { ...m, content: '', isDeleted: true, reactions: {}, myReactions: [] } : m
              )
            );
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Could not delete message');
          } finally {
            setBusyMessages((ids) => ids.filter((id) => id !== message.id));
          }
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = meRef.current ? item.sender?.id === meRef.current : false;
    const counts = reactionCounts(item);
    const mineReactions = item.myReactions || [];
    const canDelete = mine && !item.isDeleted;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          ]}
        >
          {!mine && (
            <Text style={[styles.sender, { color: colors.primary }]}>{item.sender?.username}</Text>
          )}
          <Text style={[styles.bubbleText, { color: mine ? '#0a0a0f' : colors.text }]}>
            {item.isDeleted ? 'Message deleted' : item.content}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              { color: mine ? 'rgba(10,10,15,0.6)' : colors.textDim },
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {!item.isDeleted && Object.keys(counts).length > 0 && (
            <View style={styles.reactionSummary}>
              {Object.entries(counts).map(([emoji, count]) => (
                <View
                  key={emoji}
                  style={[
                    styles.reactionChip,
                    { borderColor: mineReactions.includes(emoji) ? colors.primary : colors.border },
                  ]}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionCount, { color: mine ? '#0a0a0f' : colors.textMuted }]}>
                    {count}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!item.isDeleted && (
            <View style={styles.messageActions}>
              <TouchableOpacity
                onPress={() => setExpandedReactions((id) => (id === item.id ? null : item.id))}
                accessibilityLabel="Add reaction"
              >
                <Text style={[styles.actionText, { color: mine ? '#0a0a0f' : colors.textMuted }]}>☺ React</Text>
              </TouchableOpacity>
              {canDelete && (
                <TouchableOpacity
                  onPress={() => deleteMessage(item)}
                  accessibilityLabel="Delete message"
                  disabled={busyMessages.includes(item.id)}
                >
                  <Text style={[styles.actionText, { color: mine ? '#7f1d1d' : colors.error }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {expandedReactions === item.id && (
            <View style={[styles.reactionPicker, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => reactToMessage(item, emoji)}
                  disabled={busyMessages.includes(item.id)}
                  accessibilityLabel={`React with ${emoji}`}
                >
                  <Text style={styles.pickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={title} emoji="💬" subtitle="Direct message" />
        <LoadingBlock label="Checking your session…" />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={title} emoji="💬" subtitle="Direct message" />
        <SignedOutCard message="Sign in to read and send direct messages." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={title} emoji="💬" subtitle="Direct message" />

      {loading ? (
        <LoadingBlock label="Loading messages…" />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No messages yet — say hi 👋
            </Text>
          }
        />
      )}

      {!!remoteTyping && (
        <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.typingText, { color: colors.textMuted }]}>{remoteTyping} is typing...</Text>
        </View>
      )}

      {!!error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <View
        style={[
          styles.composer,
          {
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={onDraftChange}
          placeholder="Message…"
          placeholderTextColor={colors.textDim}
          style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: colors.primary },
            (!draft.trim() || sending) && { opacity: 0.5 },
          ]}
          onPress={send}
          disabled={!draft.trim() || sending}
          accessibilityLabel="Send message"
        >
          {sending ? <Text style={styles.sendText}>…</Text> : <Text style={styles.sendText}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sender: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  bubbleText: { fontSize: fontSize.sm, lineHeight: 19 },
  bubbleTime: { fontSize: 9, marginTop: 3, alignSelf: 'flex-end' },
  reactionSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 6, paddingVertical: 2 },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 9, fontWeight: '800' },
  messageActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  actionText: { fontSize: 10, fontWeight: '800' },
  reactionPicker: { flexDirection: 'row', gap: 4, borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 6, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' },
  pickerEmoji: { fontSize: 18 },
  typingBubble: { alignSelf: 'flex-start', marginHorizontal: spacing.md, marginBottom: 4, borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: 6 },
  typingText: { fontSize: fontSize.xs, fontStyle: 'italic' },
  empty: { textAlign: 'center', marginTop: spacing.xl, fontSize: fontSize.sm },
  error: { fontSize: fontSize.xs, textAlign: 'center', paddingBottom: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 18, color: '#0a0a0f', fontWeight: '900' },
});
