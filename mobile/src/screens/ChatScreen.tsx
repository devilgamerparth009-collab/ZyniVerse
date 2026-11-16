import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { api, ChatMessage } from '../services/api';

const POLL_MS = 6000;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();

  const initialConversationId: string | undefined = route.params?.conversationId;
  const userId: string | undefined = route.params?.userId;
  const title: string = route.params?.username || 'Chat';

  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const meRef = useRef<string | null>(null);

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
        const list = await api.chat.messages(id, 60);
        setMessages(list);
        setError(null);
        api.chat.markRead(id).catch(() => {});
      } catch (e: any) {
        setError(e?.message || 'Could not load messages');
      } finally {
        setLoading(false);
      }
    },
    [resolveConversation]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  // Light polling keeps the thread fresh without adding a realtime dependency
  // to the APK. Pauses automatically when the screen unmounts.
  useEffect(() => {
    const timer = setInterval(() => {
      load(false);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    api.auth
      .current()
      .then((u) => {
        meRef.current = u?.id || null;
      })
      .catch(() => {});
  }, []);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft('');
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
    } catch (e: any) {
      setDraft(content);
      setError(e?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = meRef.current ? item.sender?.id === meRef.current : false;
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
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={title} emoji="💬" subtitle="Direct message" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
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

      {!!error && <Text style={[styles.error, { color: '#f87171' }]}>{error}</Text>}

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
          onChangeText={setDraft}
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
        >
          {sending ? (
            <ActivityIndicator color="#0a0a0f" size="small" />
          ) : (
            <Text style={styles.sendText}>➤</Text>
          )}
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
