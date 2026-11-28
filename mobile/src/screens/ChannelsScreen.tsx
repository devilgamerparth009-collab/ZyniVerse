import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import AdBanner from '../components/AdBanner';
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
import { api } from '../services/api';
import { ChannelSummary } from '../types/social';
import { spacing, fontSize, borderRadius } from '../theme';
import { formatCount, timeAgo } from '../utils/helpers';

export default function ChannelsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { checking, signedIn } = useSocialAuth();

  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySlugs, setBusySlugs] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setChannels(await api.channels.list());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load channels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && signedIn) void load();
  }, [checking, signedIn, load]);

  const toggleSubscribe = async (channel: ChannelSummary) => {
    if (busySlugs.includes(channel.slug)) return;
    const next = !channel.isSubscribed;
    setBusySlugs((list) => [...list, channel.slug]);
    const apply = (subscribed: boolean, count: number) =>
      setChannels((list) =>
        list.map((c) =>
          c.id === channel.id
            ? { ...c, isSubscribed: subscribed, subscriberCount: count }
            : c
        )
      );
    apply(next, channel.subscriberCount + (next ? 1 : -1));
    try {
      const result = await api.channels.subscribe(channel.slug, next);
      apply(!!result.subscribed, Number(result.subscriberCount) || 0);
    } catch (e: unknown) {
      apply(!next, channel.subscriberCount);
      setError(e instanceof Error ? e.message : 'Could not update subscription');
    } finally {
      setBusySlugs((list) => list.filter((s) => s !== channel.slug));
    }
  };

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setFormError('Use a name between 2 and 60 characters.');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const channel = await api.channels.create({
        name: trimmed,
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
      });
      setName('');
      setDescription('');
      setIconUrl('');
      setCoverUrl('');
      setShowForm(false);
      await load();
      navigation.navigate('ChannelDetail', { slug: channel.slug });
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not create channel');
    } finally {
      setCreating(false);
    }
  };

  const renderChannel = ({ item }: { item: ChannelSummary }) => {
    const official = !!(item.isOfficial || item.slug === 'zyniverse' || item.name === 'ZyniVerse');
    return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.cardHead}
        onPress={() => navigation.navigate('ChannelDetail', { slug: item.slug })}
        activeOpacity={0.8}
      >
        <View style={[styles.icon, { borderColor: colors.border }]}>
          <SocialAvatar
            name={item.name}
            uri={official ? '/logo.png' : item.iconUrl}
            size={44}
            verified={official}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {official && (
              <View style={[styles.badge, { backgroundColor: `${colors.primary}22` }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>✓ Official</Text>
              </View>
            )}
          </View>
          <Text style={[styles.meta, { color: colors.textDim }]} numberOfLines={1}>
            {formatCount(item.subscriberCount)} subscribers · {formatCount(item.postCount)} posts
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textDim }]}>›</Text>
      </TouchableOpacity>

      {!!item.description && (
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {item.latestPost && (
        <TouchableOpacity
          style={[styles.latest, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={() => navigation.navigate('ChannelDetail', { slug: item.slug })}
          activeOpacity={0.8}
        >
          <Text style={[styles.latestLabel, { color: colors.primary }]}>LATEST POST</Text>
          <Text style={[styles.latestText, { color: colors.text }]} numberOfLines={2}>
            {item.latestPost.content}
          </Text>
          <Text style={[styles.latestTime, { color: colors.textDim }]}>
            {timeAgo(item.latestPost.createdAt)}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <PillButton
          label={item.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
          variant={item.isSubscribed ? 'outline' : 'primary'}
          busy={busySlugs.includes(item.slug)}
          small
          onPress={() => toggleSubscribe(item)}
        />
        <PillButton
          label="Open channel"
          variant="subtle"
          small
          onPress={() => navigation.navigate('ChannelDetail', { slug: item.slug })}
        />
      </View>
    </View>
    );
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Channels" emoji="📣" subtitle="Updates from creators" />
        <LoadingBlock label="Checking your session…" />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Channels" emoji="📣" subtitle="Updates from creators" />
        <SignedOutCard message="Sign in to subscribe to channels and post updates." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Channels"
        emoji="📣"
        subtitle="Broadcast updates from creators"
        right={
          <TouchableOpacity
            onPress={() => setShowForm((v) => !v)}
            accessibilityLabel={showForm ? 'Close create channel form' : 'Create channel'}
            style={[styles.headerBtn, { backgroundColor: `${colors.primary}22` }]}
          >
            <Text style={[styles.headerBtnText, { color: colors.primary }]}>{showForm ? '✕' : '+'}</Text>
          </TouchableOpacity>
        }
      />

      {showForm && (
        <ScrollView
          style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.formTitle, { color: colors.text }]}>Create a channel</Text>
          {[
            { label: 'Name', value: name, set: setName, placeholder: 'Your channel name' },
            { label: 'Description', value: description, set: setDescription, placeholder: 'What is it about?' },
            { label: 'Icon URL (optional)', value: iconUrl, set: setIconUrl, placeholder: 'https://…' },
            { label: 'Cover URL (optional)', value: coverUrl, set: setCoverUrl, placeholder: 'https://…' },
          ].map((field) => (
            <View key={field.label} style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
              <TextInput
                value={field.value}
                onChangeText={field.set}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textDim}
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                autoCapitalize={field.label === 'Name' ? 'words' : 'none'}
                autoCorrect={false}
              />
            </View>
          ))}
          {!!formError && <Text style={[styles.formError, { color: colors.error }]}>{formError}</Text>}
          <PillButton label={creating ? 'Creating…' : 'Create channel'} busy={creating} onPress={() => void create()} />
          <Text style={[styles.formHint, { color: colors.textDim }]}>
            Only the channel owner can publish posts.
          </Text>
        </ScrollView>
      )}

      {loading ? (
        <LoadingBlock label="Loading channels…" />
      ) : error && channels.length === 0 ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <>
          {!!error && <Text style={[styles.inlineError, { color: colors.error }]}>{error}</Text>}
          <FlatList
            data={channels}
            keyExtractor={(item) => item.id}
            renderItem={renderChannel}
            ListFooterComponent={
              <View style={styles.adFooter}>
                <AdBanner placement="channels-bottom" size="medium" />
              </View>
            }
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
                emoji="📣"
                title="No channels yet"
                message="Create the first one with the + button above."
              />
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  inlineError: { fontSize: fontSize.xs, textAlign: 'center', paddingTop: spacing.sm },
  adFooter: { paddingBottom: spacing.sm },
  form: { margin: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, maxHeight: 420 },
  formContent: { padding: spacing.md },
  formTitle: { fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm },
  field: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: '700', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 10, height: 38, fontSize: fontSize.sm },
  formError: { fontSize: fontSize.xs, marginBottom: spacing.sm },
  formHint: { fontSize: 10, marginTop: spacing.sm, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 46, height: 46, borderRadius: 10, borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: fontSize.sm, fontWeight: '800', flexShrink: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText: { fontSize: 9, fontWeight: '900' },
  meta: { fontSize: 10, marginTop: 3 },
  chevron: { fontSize: 22 },
  description: { fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.sm },
  latest: { borderWidth: 1, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  latestLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  latestText: { fontSize: fontSize.xs, lineHeight: 17, marginTop: 3 },
  latestTime: { fontSize: 9, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
});
