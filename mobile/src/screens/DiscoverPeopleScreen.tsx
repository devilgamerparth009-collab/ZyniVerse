import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
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
import { DiscoveredUser } from '../types/social';
import { spacing, fontSize, borderRadius } from '../theme';
import { formatCount } from '../utils/helpers';

const GREETING = 'Hi! I noticed we have similar taste. What are you watching?';

export default function DiscoverPeopleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { checking, signedIn } = useSocialAuth();

  const [people, setPeople] = useState<DiscoveredUser[]>([]);
  const [results, setResults] = useState<DiscoveredUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPeople(await api.discover.list(24));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load people');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && signedIn) void load();
  }, [checking, signedIn, load]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSearching(false);
      setSearchError(null);
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await api.discover.search(text));
      } catch (e: unknown) {
        setResults([]);
        setSearchError(e instanceof Error ? e.message : 'Could not search people');
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const toggleFollow = async (person: DiscoveredUser) => {
    if (busyIds.includes(person.id)) return;
    const next = !person.isFollowing;
    setBusyIds((ids) => [...ids, person.id]);
    const apply = (value: boolean) => {
      const update = (p: DiscoveredUser) => (p.id === person.id ? { ...p, isFollowing: value } : p);
      setPeople((list) => list.map(update));
      setResults((list) => list.map(update));
    };
    apply(next);
    try {
      await api.follow(person.id, next);
    } catch (e: unknown) {
      apply(!next);
      setError(e instanceof Error ? e.message : 'Could not update follow');
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== person.id));
    }
  };

  const sayHi = (person: DiscoveredUser) => {
    navigation.navigate('Chat', {
      userId: person.id,
      username: person.username,
      avatar: person.avatar,
      initialMessage: GREETING,
    });
  };

  const data = query.trim() ? results : people;
  const listError = query.trim() ? searchError : error;

  const renderPerson = ({ item }: { item: DiscoveredUser }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.identity}
        onPress={() => navigation.navigate('UserProfile', { username: item.username })}
        activeOpacity={0.8}
      >
        <SocialAvatar name={item.username} uri={item.avatar} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.username}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.reason, { color: colors.primary }]} numberOfLines={1}>
              {item.reason || 'People you may know'}
            </Text>
            {item.mutualFollowers > 0 && (
              <Text style={[styles.meta, { color: colors.textDim }]} numberOfLines={1}>
                · {formatCount(item.mutualFollowers)} mutual
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {!!item.bio && (
        <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={2}>
          {item.bio}
        </Text>
      )}

      <View style={styles.actions}>
        <PillButton
          label={item.isFollowing ? 'Following' : item.isFriend ? 'Friend' : 'Follow'}
          variant={item.isFollowing ? 'outline' : 'primary'}
          busy={busyIds.includes(item.id)}
          onPress={() => toggleFollow(item)}
          small
        />
        <PillButton
          label="Message"
          variant="subtle"
          small
          onPress={() =>
            navigation.navigate('Chat', {
              userId: item.id,
              username: item.username,
              avatar: item.avatar,
            })
          }
        />
        <PillButton label="Say hi" variant="subtle" small onPress={() => sayHi(item)} />
      </View>
    </View>
  );

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Discover people" emoji="🧭" subtitle="Meet other fans" />
        <LoadingBlock label="Checking your session…" />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Discover people" emoji="🧭" subtitle="Meet other fans" />
        <SignedOutCard message="Sign in to see people you might know and follow them." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Discover people" emoji="🧭" subtitle="Meet other fans" />

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textDim }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search people by name"
          placeholderTextColor={colors.textDim}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <Text style={[styles.searchHint, { color: colors.textDim }]}>Searching…</Text>}
      </View>

      {!query.trim() && loading ? (
        <LoadingBlock label="Finding people…" />
      ) : !query.trim() && error && people.length === 0 ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <>
          {!!listError && (
            <Text style={[styles.inlineError, { color: colors.error }]}>{listError}</Text>
          )}
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={renderPerson}
            contentContainerStyle={{
              padding: spacing.md,
              paddingBottom: insets.bottom + spacing.xxl,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (query.trim()) {
                    setRefreshing(false);
                    return;
                  }
                  setRefreshing(true);
                  void load();
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              searching ? (
                <LoadingBlock label="Searching…" />
              ) : (
                <EmptyBlock
                  emoji="🧭"
                  title={query.trim() ? 'No people found' : 'No people to show yet'}
                  message={
                    query.trim()
                      ? 'Try a different username.'
                      : 'Check back soon as more fans join ZyniVerse.'
                  }
                  actionLabel={query.trim() ? undefined : 'Try again'}
                  onAction={query.trim() ? undefined : () => void load()}
                />
              )
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, paddingVertical: 0 },
  searchHint: { fontSize: 10 },
  inlineError: { fontSize: fontSize.xs, textAlign: 'center', paddingTop: spacing.sm },
  card: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: fontSize.sm, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  reason: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 10 },
  bio: { fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
});
