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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { spacing, fontSize, borderRadius } from '../theme';
import { listLocalRecords, putLocalRecord } from '../services/localRepo';

type ChatKind = 'direct' | 'group';

interface LocalConversation {
  id: string;
  kind: ChatKind;
  name: string;
  members: string[];
  emoji: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
}

interface LocalChatMessage {
  id: string;
  conversationId: string;
  author: string;
  body: string;
  createdAt: number;
  mine: boolean;
}

function timeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export default function LocalChatsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [selected, setSelected] = useState<LocalConversation | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [kind, setKind] = useState<ChatKind>('direct');
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [draft, setDraft] = useState('');
  const mounted = useRef(true);
  const listRef = useRef<FlatList<LocalChatMessage>>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadConversations = useCallback(async () => {
    const records = await listLocalRecords<LocalConversation>('chat:conversations');
    if (mounted.current) {
      setConversations(records.map((record) => record.data));
      setSelected((current) => {
        if (!current) return null;
        return records.find((record) => record.data.id === current.id)?.data || null;
      });
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const records = await listLocalRecords<LocalChatMessage>('chat:messages');
    if (mounted.current) {
      setMessages(
        records
          .map((record) => record.data)
          .filter((message) => message.conversationId === conversationId)
          .sort((a, b) => a.createdAt - b.createdAt)
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  useEffect(() => {
    if (selected) void loadMessages(selected.id);
    else setMessages([]);
  }, [selected, loadMessages]);

  const createConversation = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const memberNames =
      kind === 'group'
        ? members
            .split(',')
            .map((member) => member.trim())
            .filter(Boolean)
            .slice(0, 12)
        : [trimmed];
    const conversation: LocalConversation = {
      id: `conv-${now}`,
      kind,
      name: trimmed,
      members: memberNames,
      emoji: kind === 'group' ? '👥' : '💬',
      createdAt: now,
      updatedAt: now,
      lastMessage: kind === 'group' ? 'Group created on this device' : 'Conversation started on this device',
    };
    await putLocalRecord('chat:conversations', conversation, conversation.id);
    setName('');
    setMembers('');
    setKind('direct');
    setShowCreate(false);
    setSelected(conversation);
    await loadConversations();
  }, [name, members, kind, loadConversations]);

  const sendMessage = useCallback(async () => {
    const body = draft.trim();
    if (!body || !selected) return;
    const now = Date.now();
    const message: LocalChatMessage = {
      id: `msg-${now}`,
      conversationId: selected.id,
      author: 'You',
      body,
      createdAt: now,
      mine: true,
    };
    await putLocalRecord('chat:messages', message, message.id);
    await putLocalRecord(
      'chat:conversations',
      { ...selected, lastMessage: body, updatedAt: now },
      selected.id
    );
    setDraft('');
    await Promise.all([loadMessages(selected.id), loadConversations()]);
  }, [draft, selected, loadMessages, loadConversations]);

  const renderConversation = ({ item }: { item: LocalConversation }) => (
    <PressableScale
      onPress={() => setSelected(item)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.avatar, { backgroundColor: `${colors.primary}22` }]}>
        <Text style={styles.avatarText}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.time, { color: colors.textDim }]}>{timeLabel(item.updatedAt)}</Text>
        </View>
        <Text style={[styles.meta, { color: colors.primary }]}>
          {item.kind === 'group' ? `GROUP · ${item.members.length} members` : 'DIRECT MESSAGE'}
        </Text>
        <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
      </View>
    </PressableScale>
  );

  const renderMessage = ({ item }: { item: LocalChatMessage }) => (
    <View
      style={[
        styles.bubble,
        item.mine
          ? { backgroundColor: colors.primary, alignSelf: 'flex-end' }
          : { backgroundColor: colors.surfaceLight, alignSelf: 'flex-start' },
      ]}
    >
      <Text style={[styles.bubbleText, { color: item.mine ? '#08090f' : colors.text }]}>{item.body}</Text>
      <Text style={[styles.bubbleTime, { color: item.mine ? '#08090f99' : colors.textDim }]}>
        {item.author} · {timeLabel(item.createdAt)}
      </Text>
    </View>
  );

  if (selected) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.detailHeader, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.back, { color: colors.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={1}>
              {selected.emoji} {selected.name}
            </Text>
            <Text style={[styles.detailSub, { color: colors.textDim }]} numberOfLines={1}>
              {selected.kind === 'group' ? 'Group chat · Saved on this device' : 'DM · Saved on this device'}
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md }}
          renderItem={renderMessage}
          ListEmptyComponent={
            <View style={styles.emptyMini}>
              <Text style={styles.emptyIcon}>👋</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Say hello</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Messages are stored locally on this device only.
              </Text>
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={[styles.composer, { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message"
            placeholderTextColor={colors.textDim}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={() => void sendMessage()}
            disabled={!draft.trim()}
            style={[styles.send, { backgroundColor: draft.trim() ? colors.primary : colors.surfaceLight }]}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Chat"
        emoji="💬"
        subtitle="DMs and group chats, saved locally"
        right={
          <TouchableOpacity
            onPress={() => setShowCreate((value) => !value)}
            style={[styles.headerBtn, { borderColor: colors.border }]}
            accessibilityLabel={showCreate ? 'Close new chat form' : 'New chat'}
          >
            <Text style={[styles.headerBtnText, { color: colors.text }]}>{showCreate ? '✕' : '+'}</Text>
          </TouchableOpacity>
        }
      />

      {showCreate && (
        <View style={[styles.createCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.createTitle, { color: colors.text }]}>New conversation</Text>
          <View style={styles.kindRow}>
            {(['direct', 'group'] as ChatKind[]).map((option) => {
              const active = kind === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setKind(option)}
                  style={[
                    styles.kindChip,
                    { borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.kindText, { color: active ? '#08090f' : colors.textMuted }]}>
                    {option === 'direct' ? 'DM' : 'Group'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'group' ? 'Group name' : 'Person or nickname'}
            placeholderTextColor={colors.textDim}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          />
          {kind === 'group' && (
            <TextInput
              value={members}
              onChangeText={setMembers}
              placeholder="Members (comma separated)"
              placeholderTextColor={colors.textDim}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            />
          )}
          <TouchableOpacity
            onPress={() => void createConversation()}
            disabled={!name.trim()}
            style={[styles.createBtn, { backgroundColor: name.trim() ? colors.primary : colors.surfaceLight }]}
          >
            <Text style={styles.createBtnText}>Create chat</Text>
          </TouchableOpacity>
          <Text style={[styles.localNote, { color: colors.textDim }]}>
            Local-only: no account, server or contacts access.
          </Text>
        </View>
      )}

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl }}
        renderItem={renderConversation}
        ListEmptyComponent={
          !showCreate ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No chats yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Start a DM or group chat. Everything stays saved on this device.
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={[styles.createBtn, { backgroundColor: colors.primary, marginTop: spacing.md }]}
              >
                <Text style={styles.createBtnText}>Start a chat</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  createCard: { margin: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm },
  createTitle: { fontSize: fontSize.sm, fontWeight: '900', marginBottom: spacing.sm },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  kindChip: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1 },
  kindText: { fontSize: 10, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 12, minHeight: 40, fontSize: fontSize.sm, marginBottom: 8 },
  createBtn: { paddingVertical: 10, borderRadius: borderRadius.full, alignItems: 'center' },
  createBtnText: { color: '#08090f', fontSize: fontSize.xs, fontWeight: '900' },
  localNote: { fontSize: 10, textAlign: 'center', marginTop: 8 },
  card: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: fontSize.sm, fontWeight: '900' },
  time: { fontSize: 9 },
  meta: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  preview: { fontSize: fontSize.xs, marginTop: 4 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { fontSize: 28, lineHeight: 30, marginTop: -2 },
  detailTitle: { fontSize: fontSize.md, fontWeight: '900' },
  detailSub: { fontSize: 9, marginTop: 2 },
  bubble: { maxWidth: '82%', borderRadius: borderRadius.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 },
  bubbleText: { fontSize: fontSize.sm, lineHeight: 19 },
  bubbleTime: { fontSize: 9, marginTop: 4 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#08090f', fontSize: 16, fontWeight: '900' },
  empty: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyMini: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing.lg },
  emptyIcon: { fontSize: 38, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.sm, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: fontSize.xs, textAlign: 'center', marginTop: 6 },
});
