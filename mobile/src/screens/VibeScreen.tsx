import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { listLocalRecords } from '../services/localRepo';
import { VibeResponse, VibeTitle } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';
import { formatCount } from '../utils/helpers';

interface LocalVibe {
  tracked: number;
  clubs: number;
  hotTakes: number;
  chats: number;
}

function PulseStat({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textDim }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function WatchingRow({ item, index, maxFans }: { item: VibeTitle; index: number; maxFans: number }) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const pct = maxFans > 0 ? Math.max(6, Math.round((item.fans / maxFans) * 100)) : 6;
  const accent = index === 0 ? '#f472b6' : index === 1 ? '#c084fc' : index === 2 ? '#22d3ee' : colors.textMuted;

  return (
    <FadeInView delay={Math.min(index, 8) * 45} offset={10}>
      <PressableScale
        onPress={() => navigation.navigate('AnimeDetail', { id: item.mediaId, title: item.title })}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.rank, { color: accent }]}>{index + 1}</Text>

        <View style={[styles.rowCover, { backgroundColor: colors.surfaceLight }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.rowImage} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 20 }}>🎬</Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.rowMeta}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={[styles.rowMetaText, { color: accent }]}>
              {formatCount(item.fans)} {item.fans === 1 ? 'fan' : 'fans'} watching
            </Text>
            <Text style={[styles.rowMetaText, { color: colors.textDim }]}>
              · {formatCount(item.events)} logs
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: `${accent}22` }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: accent }]} />
          </View>
        </View>
      </PressableScale>
    </FadeInView>
  );
}

export default function VibeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isLaunch, isChristmas } = useTheme();
  const tint = isLaunch ? '#22d3ee' : isChristmas ? '#7dd3fc' : '#f472b6';

  const [data, setData] = useState<VibeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localVibe, setLocalVibe] = useState<LocalVibe | null>(null);

  const loadLocal = useCallback(async () => {
    try {
      const [tracker, clubs, hotTakes, chats] = await Promise.all([
        listLocalRecords('tracker:entries'),
        listLocalRecords('community:clubs'),
        listLocalRecords('feed:hot-takes'),
        listLocalRecords('chat:conversations'),
      ]);
      setLocalVibe({
        tracked: tracker.length,
        clubs: clubs.length,
        hotTakes: hotTakes.length,
        chats: chats.length,
      });
    } catch {
      setLocalVibe(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLocal();
    }, [loadLocal])
  );

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const res = await api.vibe.get();
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Could not read the community pulse');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxFans = data?.nowWatching?.reduce((m, t) => Math.max(m, t.fans), 0) || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Vibe"
        subtitle="What fans are watching right now"
        emoji="📡"
        accent={tint}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
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
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tint} />
            <Text style={[styles.centerText, { color: colors.textMuted }]}>Reading the room…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 34 }}>📡</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>Signal lost</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>{error}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={() => load()}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : !data ? null : (
          <>
            {/* Hero */}
            <FadeInView delay={20}>
              <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: `${tint}44` }]}>
                <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: `${tint}1c` }]} />
                <View pointerEvents="none" style={[styles.heroGlowAlt, { backgroundColor: '#22d3ee18' }]} />
                <Text style={[styles.heroEyebrow, { color: tint }]}>LIVE COMMUNITY PULSE</Text>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  {data.pulse.fans > 0
                    ? `${formatCount(data.pulse.fans)} fans are watching something right now`
                    : 'The room is quiet — start the wave'}
                </Text>
                <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                  A privacy-first roll-up of the last {data.windowDays} days. Only counts — never names,
                  never anyone's list.
                </Text>
              </View>
            </FadeInView>

            {/* Local summary */}
            <FadeInView delay={45}>
              <View style={[styles.localCard, { backgroundColor: colors.surface, borderColor: `${tint}33` }]}>
                <Text style={[styles.localTitle, { color: tint }]}>🔥 Your vibe</Text>
                <Text style={[styles.localBody, { color: colors.textMuted }]}>
                  {localVibe && (localVibe.tracked || localVibe.clubs || localVibe.hotTakes || localVibe.chats)
                    ? `${localVibe.tracked} tracked titles · ${localVibe.clubs} communities · ${localVibe.hotTakes} hot takes · ${localVibe.chats} chats`
                    : 'Start your local vibe by tracking a title, joining a community or sharing a hot take.'}
                </Text>
                <Text style={[styles.localNote, { color: colors.textDim }]}>Saved on this device</Text>
                <View style={styles.localActions}>
                  <TouchableOpacity onPress={() => navigation.navigate('Tracker')}>
                    <Text style={[styles.localLink, { color: tint }]}>Open tracker →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('CommunityHub')}>
                    <Text style={[styles.localLink, { color: tint }]}>Communities →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </FadeInView>

            {/* Pulse stats */}
            <FadeInView delay={60}>
              <View style={styles.statRow}>
                <PulseStat label="Fans" value={formatCount(data.pulse.fans)} color={tint} />
                <PulseStat label="Titles" value={formatCount(data.pulse.titles)} color="#c084fc" />
                <PulseStat label="Episodes" value={formatCount(data.pulse.episodes)} color="#22d3ee" />
                <PulseStat label="Live rooms" value={formatCount(data.pulse.liveRooms)} color="#22c55e" />
              </View>
            </FadeInView>

            {/* Live rooms */}
            {data.liveRooms.length > 0 && (
              <FadeInView delay={90}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.liveDot} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Live watch parties</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('WatchParty')}>
                    <Text style={[styles.seeAll, { color: tint }]}>See all →</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.roomScroll}
                >
                  {data.liveRooms.map((room) => (
                    <PressableScale
                      key={room.id}
                      onPress={() => navigation.navigate('WatchPartyRoom', { id: room.id })}
                      style={[styles.roomCard, { backgroundColor: colors.surface, borderColor: `${tint}33` }]}
                    >
                      <View style={[styles.roomCover, { backgroundColor: colors.surfaceLight }]}>
                        {room.image ? (
                          <Image source={{ uri: room.image }} style={styles.roomImage} resizeMode="cover" />
                        ) : (
                          <Text style={{ fontSize: 22 }}>🍿</Text>
                        )}
                        <View style={styles.roomLive}>
                          <View style={styles.liveDotSmall} />
                          <Text style={styles.roomLiveText}>LIVE</Text>
                        </View>
                      </View>
                      <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={2}>
                        {room.title}
                      </Text>
                      <Text style={[styles.roomMeta, { color: colors.textDim }]} numberOfLines={1}>
                        EP {room.episode} · {room.members} in room
                      </Text>
                    </PressableScale>
                  ))}
                </ScrollView>
              </FadeInView>
            )}

            {/* Now watching */}
            <FadeInView delay={120}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Now watching</Text>
                </View>
                <Text style={[styles.sectionMeta, { color: colors.textDim }]}>
                  {data.nowWatching.length} titles
                </Text>
              </View>
            </FadeInView>

            {data.nowWatching.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ fontSize: 38 }}>🌙</Text>
                <Text style={[styles.centerTitle, { color: colors.text }]}>No activity in the window</Text>
                <Text style={[styles.centerText, { color: colors.textMuted }]}>
                  When fans update their lists, the pulse lights up here.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {data.nowWatching.map((item, i) => (
                  <WatchingRow key={item.mediaId} item={item} index={i} maxFans={maxFans} />
                ))}
              </View>
            )}

            <FadeInView delay={160}>
              <View style={[styles.privacyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.privacyTitle, { color: colors.text }]}>🔒 Privacy first</Text>
                <Text style={[styles.privacyText, { color: colors.textMuted }]}>
                  Vibe only counts. No usernames, no user ids, no individual lists are ever returned by
                  this screen — just the shape of the fandom.
                </Text>
              </View>
            </FadeInView>

            <Text style={[styles.footnote, { color: colors.textDim }]}>
              Updated {new Date(data.generatedAt).toLocaleString()}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 30, gap: 8 },
  centerTitle: { fontSize: 16, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  centerText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  primaryBtn: { marginTop: 10, borderRadius: borderRadius.md, paddingHorizontal: 18, paddingVertical: 10 },
  primaryBtnText: { color: '#0a0a0f', fontSize: 12, fontWeight: '900' },
  hero: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', right: -46, top: -52, width: 150, height: 150, borderRadius: 75 },
  heroGlowAlt: { position: 'absolute', left: -40, bottom: -60, width: 130, height: 130, borderRadius: 65 },
  heroEyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 17, fontWeight: '900', lineHeight: 22, marginTop: 5 },
  heroSub: { fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  localCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm },
  localTitle: { fontSize: 12, fontWeight: '900' },
  localBody: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  localNote: { fontSize: 9, marginTop: 5 },
  localActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  localLink: { fontSize: 10, fontWeight: '900' },
  statRow: { flexDirection: 'row', gap: 7, paddingHorizontal: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: 9, paddingHorizontal: 8 },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginTop: 2, textTransform: 'uppercase' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 14.5, fontWeight: '900' },
  sectionMeta: { fontSize: 10 },
  seeAll: { fontSize: 11, fontWeight: '800' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  liveDotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  roomScroll: { paddingHorizontal: spacing.md, gap: 10 },
  roomCard: { width: 118, borderWidth: 1, borderRadius: borderRadius.md, padding: 7 },
  roomCover: {
    width: '100%',
    height: 78,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomImage: { width: '100%', height: '100%' },
  roomLive: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  roomLiveText: { color: '#fff', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  roomTitle: { fontSize: 11, fontWeight: '800', marginTop: 6, lineHeight: 15 },
  roomMeta: { fontSize: 9, marginTop: 2 },
  list: { paddingHorizontal: spacing.md, gap: 9 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  rank: { width: 18, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  rowCover: { width: 42, height: 58, borderRadius: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowImage: { width: '100%', height: '100%' },
  rowTitle: { fontSize: 12.5, fontWeight: '800', lineHeight: 16 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  rowMetaText: { fontSize: 9.5, fontWeight: '700' },
  track: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  privacyCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
  },
  privacyTitle: { fontSize: 12, fontWeight: '900' },
  privacyText: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  footnote: { fontSize: 9, textAlign: 'center', marginTop: spacing.md },
});
