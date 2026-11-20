import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { User, WatchParty, WatchPartySearchResult } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import SafeImage from '../components/SafeImage';
import AnimatedTabBar, { type AnimatedTabItem } from '../components/AnimatedTabBar';
import { PartyListSkeleton } from '../components/Skeletons';
import { spacing, borderRadius } from '../theme';
import { timeAgo } from '../utils/helpers';

const STATUS_META: Record<string, { label: string; color: string }> = {
  waiting: { label: 'WAITING', color: '#f59e0b' },
  live: { label: 'LIVE', color: '#ef4444' },
  ended: { label: 'ENDED', color: '#64748b' },
};

type PartyTab = 'live' | 'mine';

const PARTY_TABS: AnimatedTabItem<PartyTab>[] = [
  { key: 'live', label: 'Live now' },
  { key: 'mine', label: 'My parties' },
];

function Avatar({
  uri,
  name,
  size = 26,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
}) {
  return (
    <SafeImage
      uri={uri}
      fallbackLabel={name || 'Fan'}
      accessibilityLabel={name || 'Fan'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1a1a2e',
      }}
    />
  );
}

export default function WatchPartyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch, isChristmas } = useTheme();
  const tint = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : colors.primary;

  const [tab, setTab] = useState<PartyTab>('live');
  const [live, setLive] = useState<WatchParty[]>([]);
  const [mine, setMine] = useState<WatchParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WatchPartySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<WatchPartySearchResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const current = await getCurrentUser().catch(() => null);
      setUser(current);

      const [liveParties, myParties] = await Promise.all([
        api.watchParty.list().catch(() => [] as WatchParty[]),
        current ? api.watchParty.list(true).catch(() => [] as WatchParty[]) : Promise.resolve([] as WatchParty[]),
      ]);
      setLive(liveParties.filter((p) => p.status !== 'ended'));
      setMine(myParties);
    } catch (e: any) {
      setError(e?.message || 'Could not load watch parties');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Debounced anime search for the create sheet.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const found = await api.watchParty.search(q);
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const openCreate = () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setQuery('');
    setResults([]);
    setSelected(null);
    setCreateError(null);
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!selected || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const party = await api.watchParty.create({
        mediaId: selected.id,
        mediaTitle: selected.title,
        mediaImage: selected.image || null,
        coverImage: selected.image || null,
      });
      closeCreate();
      await load(true);
      navigation.navigate('WatchPartyRoom', { id: party.id });
    } catch (e: any) {
      setCreateError(e?.message || 'Could not start the party');
      setCreating(false);
    }
  };

  const list = tab === 'live' ? live : mine;

  const tabsWithCounts = useMemo(
    () =>
      PARTY_TABS.map((item) => ({
        ...item,
        badge: item.key === 'live' ? live.length : mine.length,
      })),
    [live.length, mine.length]
  );

  const headerRight = useMemo(
    () => (
      <PressableScale
        onPress={openCreate}
        scaleTo={0.92}
        style={[styles.newBtn, { backgroundColor: `${tint}1f`, borderColor: `${tint}66` }]}
      >
        <Text style={[styles.newBtnText, { color: tint }]}>＋ New</Text>
      </PressableScale>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tint, user]
  );

  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
    transform: [
      {
        translateX: glow.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] }),
      },
      {
        scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }),
      },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Watch Party"
        subtitle="Synced episodes, live chat, one room"
        emoji="👥"
        accent={tint}
        right={headerRight}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={tint}
          />
        }
      >
        <AnimatedTabBar<PartyTab>
          tabs={tabsWithCounts}
          active={tab}
          onChange={setTab}
          tint={tint}
          surface={colors.surface}
          border={colors.border}
          muted={colors.textMuted}
          equal
          contentContainerStyle={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}
        />

        <FadeInView delay={60}>
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: `${tint}44` }]}>
            <Animated.View
              pointerEvents="none"
              style={[styles.heroGlow, { backgroundColor: `${tint}22` }, glowStyle]}
            />
            <Text style={[styles.heroEyebrow, { color: tint }]}>TOGETHER, IN SYNC</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              {user ? 'Your crew, one timeline' : 'Watch together, wherever you are'}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Pick an anime, invite friends, and keep every episode in sync. Chat and reactions stay
              in the room.
            </Text>
            <PressableScale
              onPress={openCreate}
              scaleTo={0.94}
              style={[styles.heroBtn, { backgroundColor: tint }]}
            >
              <Text style={styles.heroBtnText}>
                {user ? 'Start a watch party' : 'Sign in to host'}
              </Text>
            </PressableScale>
          </View>
        </FadeInView>

        {loading ? (
          <PartyListSkeleton />
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 34 }}>📡</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>Rooms unavailable</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>{error}</Text>
            <PressableScale
              style={[styles.retryBtn, { backgroundColor: tint }]}
              onPress={() => load()}
            >
              <Text style={styles.retryText}>Try again</Text>
            </PressableScale>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 40 }}>🍿</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>
              {tab === 'live' ? 'No parties running' : 'You have not joined any party'}
            </Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              {tab === 'live'
                ? 'Be the first to start one — it takes two taps.'
                : 'Create a room or join a live one from the other tab.'}
            </Text>
            <PressableScale style={[styles.retryBtn, { backgroundColor: tint }]} onPress={openCreate}>
              <Text style={styles.retryText}>Start a party</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((party, i) => {
              const status = STATUS_META[party.status] || STATUS_META.waiting;
              const cover = party.coverImage || party.mediaImage;
              return (
                <FadeInView key={party.id} delay={Math.min(i, 8) * 55} offset={12}>
                  <PressableScale
                    onPress={() => navigation.navigate('WatchPartyRoom', { id: party.id })}
                    scaleTo={0.975}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <SafeImage
                      uri={cover}
                      fallbackLabel={party.mediaTitle}
                      style={styles.cover}
                      accessibilityLabel={party.mediaTitle}
                    />
                    <View style={[styles.statusPill, { backgroundColor: status.color }]}>
                      <Text style={styles.statusText}>{status.label}</Text>
                    </View>

                    <View style={styles.cardBody}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {party.mediaTitle}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        Episode {party.episode} · {party.members?.length || 1} watching
                      </Text>
                      <View style={styles.hostRow}>
                        <Avatar uri={party.host?.avatar} name={party.host?.username} size={22} />
                        <Text style={[styles.hostName, { color: colors.textDim }]} numberOfLines={1}>
                          {party.host?.username || 'Host'}
                        </Text>
                        <Text style={[styles.dot, { color: colors.textDim }]}>•</Text>
                        <Text style={[styles.hostName, { color: colors.textDim }]}>
                          {timeAgo(party.createdAt)}
                        </Text>
                      </View>

                      <View style={styles.memberRow}>
                        {(party.members || []).slice(0, 5).map((m) => (
                          <View key={m.id} style={[styles.memberAvatar, { borderColor: colors.surface }]}>
                            <Avatar uri={m.user?.avatar} name={m.user?.username} size={24} />
                          </View>
                        ))}
                        {(party.members?.length || 0) > 5 && (
                          <Text style={[styles.moreMembers, { color: colors.textDim }]}>
                            +{(party.members?.length || 0) - 5}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={[styles.joinBtn, { backgroundColor: `${tint}1c`, borderColor: `${tint}55` }]}>
                      <Text style={[styles.joinText, { color: tint }]}>Join</Text>
                    </View>
                  </PressableScale>
                </FadeInView>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={closeCreate}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeCreate} />
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Start a watch party</Text>
            <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
              Search an anime, then invite your friends.
            </Text>

            <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.textDim }}>🔍</Text>
              <TextInput
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setSelected(null);
                }}
                placeholder="Search anime..."
                placeholderTextColor={colors.textDim}
                style={[styles.searchInput, { color: colors.text }]}
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color={tint} />}
            </View>

            {selected ? (
              <View style={[styles.selectedCard, { backgroundColor: colors.surface, borderColor: `${tint}66` }]}>
                <SafeImage
                  uri={selected.image}
                  fallbackLabel={selected.title}
                  style={styles.selectedImage}
                  accessibilityLabel={selected.title}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectedTitle, { color: colors.text }]} numberOfLines={2}>
                    {selected.title}
                  </Text>
                  <Text style={[styles.selectedMeta, { color: colors.textMuted }]}>
                    {[selected.episodes ? `${selected.episodes} eps` : null, selected.year, selected.status]
                      .filter(Boolean)
                      .join(' • ') || 'Anime'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                  <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : results.length > 0 ? (
              <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
                {results.map((r) => (
                  <PressableScale
                    key={r.id}
                    onPress={() => {
                      setSelected(r);
                      setQuery(r.title);
                      setResults([]);
                    }}
                    scaleTo={0.97}
                    style={[styles.resultRow, { borderColor: colors.border }]}
                  >
                    <SafeImage
                      uri={r.image}
                      fallbackLabel={r.title}
                      style={styles.resultImage}
                      accessibilityLabel={r.title}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={[styles.resultMeta, { color: colors.textDim }]}>
                        {[r.episodes ? `${r.episodes} eps` : null, r.year, r.status]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </View>
                    <Text style={{ color: tint, fontWeight: '900' }}>›</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            ) : query.trim().length >= 2 && !searching ? (
              <Text style={[styles.noResults, { color: colors.textDim }]}>
                No anime matched “{query.trim()}”.
              </Text>
            ) : null}

            {!!createError && (
              <Text style={[styles.errorText, { color: colors.error }]}>{createError}</Text>
            )}

            <PressableScale
              disabled={!selected || creating}
              onPress={handleCreate}
              scaleTo={0.97}
              style={[
                styles.createBtn,
                { backgroundColor: selected ? tint : colors.surfaceLight, opacity: creating ? 0.7 : 1 },
              ]}
            >
              {creating ? (
                <ActivityIndicator color="#0a0a0f" />
              ) : (
                <Text style={[styles.createText, { color: selected ? '#0a0a0f' : colors.textDim }]}>
                  Create party
                </Text>
              )}
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  newBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 7 },
  newBtnText: { fontSize: 12, fontWeight: '900' },
  heroCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md + 2,
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', right: -60, top: -70, width: 180, height: 180, borderRadius: 90 },
  heroEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  heroSub: { fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  heroBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: borderRadius.full,
    paddingHorizontal: 20,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  heroBtnText: { color: '#0a0a0f', fontSize: 13.5, fontWeight: '900' },
  list: { paddingHorizontal: spacing.md, gap: 12, marginTop: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  cover: { width: 78, height: 110, borderRadius: borderRadius.md },
  statusPill: { position: 'absolute', top: 17, left: 17, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardMeta: { fontSize: 12, marginTop: 4 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  hostName: { fontSize: 11, maxWidth: 100 },
  dot: { fontSize: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  memberAvatar: { borderWidth: 1.5, borderRadius: 14, marginRight: -6 },
  moreMembers: { fontSize: 10, marginLeft: 10, fontWeight: '700' },
  joinBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 14, paddingVertical: 8 },
  joinText: { fontSize: 12, fontWeight: '900' },
  center: { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 30, gap: 8 },
  centerTitle: { fontSize: 17, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  centerText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 11, borderRadius: borderRadius.full },
  retryText: { color: '#0a0a0f', fontSize: 13, fontWeight: '900' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: spacing.md, paddingBottom: 26 },
  grabber: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 19, fontWeight: '900' },
  sheetSub: { fontSize: 13, marginTop: 3, marginBottom: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 9,
    marginTop: 12,
  },
  selectedImage: { width: 46, height: 64, borderRadius: 8 },
  selectedTitle: { fontSize: 14, fontWeight: '800' },
  selectedMeta: { fontSize: 11.5, marginTop: 3 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultImage: { width: 38, height: 52, borderRadius: 6 },
  resultTitle: { fontSize: 13.5, fontWeight: '700' },
  resultMeta: { fontSize: 11, marginTop: 2 },
  noResults: { fontSize: 12.5, marginTop: 14, textAlign: 'center' },
  errorText: { fontSize: 12.5, marginTop: 10 },
  createBtn: { marginTop: 14, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  createText: { fontSize: 14, fontWeight: '900' },
});
