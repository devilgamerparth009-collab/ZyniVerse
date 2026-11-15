import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { api, getCurrentUser } from '../services/api';
import { DnaProfile, User } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import { spacing, borderRadius } from '../theme';
import { defaultAvatarFor } from '../utils/helpers';

const HEX_RE = /#([0-9a-fA-F]{6})/;

function geneColor(gene: string, fallback: string): string {
  const m = gene.match(HEX_RE);
  return m ? `#${m[1]}` : fallback;
}

function geneLabel(gene: string): string {
  return gene.replace(/\s*·\s*#[0-9a-fA-F]{6}\s*$/, '').trim();
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: accent }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textDim }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TasteProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDiwali, isChristmas } = useTheme();
  const tint = isDiwali ? '#f59e0b' : isChristmas ? '#7dd3fc' : '#a78bfa';

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DnaProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      setEmpty(false);

      const current = await getCurrentUser().catch(() => null);
      setUser(current);
      if (!current) {
        setProfile(null);
        return;
      }

      const dna = await api.dna.get(current.username);
      setProfile(dna);
    } catch (e: any) {
      const message = e?.message || 'Could not decode your DNA';
      if (/not found|404/i.test(message)) {
        setEmpty(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const share = async () => {
    if (!profile) return;
    const top = profile.topGenres.map((g) => g.genre).join(', ') || 'everything';
    try {
      await Share.share({
        message:
          `🧬 My Anime DNA — "${profile.archetype.label}" on ZyniVerse!\n` +
          `🎬 ${profile.totalAnime} titles · 🏆 Mean ${profile.meanScore}/100 · 🔥 ${profile.streak}-day streak\n` +
          `Top: ${top}\n` +
          `👉 https://zyverse.in/dna/${encodeURIComponent(profile.username)}`,
      });
    } catch {
      // The share sheet can be dismissed; that is not an error.
    }
  };

  const fingerprint = profile?.fingerprint || tint;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Anime DNA"
        subtitle="Your taste, decoded"
        emoji="🧬"
        accent={tint}
        right={
          profile ? (
            <TouchableOpacity
              onPress={share}
              style={[styles.shareBtn, { borderColor: `${tint}66`, backgroundColor: `${tint}14` }]}
            >
              <Text style={[styles.shareText, { color: tint }]}>Share</Text>
            </TouchableOpacity>
          ) : undefined
        }
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
            <Text style={[styles.centerText, { color: colors.textMuted }]}>Decoding your taste…</Text>
          </View>
        ) : !user ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 44 }}>🔐</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>Sign in to see your DNA</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              Your watchlist, genres and streaks turn into a shareable Anime DNA card.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: tint }]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.primaryBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : empty ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 44 }}>🌱</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>Your DNA is still forming</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>
              Add a few titles to your watchlist and your archetype, genres and genes will appear here.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: tint }]}
              onPress={() => navigation.navigate('Browse', { mode: 'trending', title: 'Trending' })}
            >
              <Text style={styles.primaryBtnText}>Browse anime</Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 38 }}>🧬</Text>
            <Text style={[styles.centerTitle, { color: colors.text }]}>DNA unavailable</Text>
            <Text style={[styles.centerText, { color: colors.textMuted }]}>{error}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: tint }]} onPress={() => load()}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : !profile ? null : (
          <>
            {/* Hero / archetype */}
            <FadeInView delay={20}>
              <View style={[styles.hero, { borderColor: `${fingerprint}55`, backgroundColor: colors.surface }]}>
                <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: `${fingerprint}2a` }]} />
                <View pointerEvents="none" style={[styles.heroGlowAlt, { backgroundColor: `${tint}1a` }]} />

                <View style={styles.heroTop}>
                  <View style={[styles.avatarRing, { borderColor: `${fingerprint}88` }]}>
                    <Image
                      source={{ uri: profile.avatar || defaultAvatarFor(profile.username) }}
                      style={styles.avatar}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroName, { color: colors.textDim }]} numberOfLines={1}>
                      @{profile.username}
                    </Text>
                    <Text style={[styles.heroArchetype, { color: colors.text }]} numberOfLines={2}>
                      {profile.archetype.emoji} {profile.archetype.label}
                    </Text>
                  </View>
                  <View style={[styles.fingerprint, { backgroundColor: fingerprint }]}>
                    <Text style={styles.fingerprintText}>{profile.shareCode.split('-')[0].toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={[styles.punchline, { color: fingerprint }]}>{profile.archetype.punchline}</Text>
                <Text style={[styles.blurb, { color: colors.textMuted }]}>{profile.archetype.blurb}</Text>
              </View>
            </FadeInView>

            {/* Stats */}
            <FadeInView delay={60}>
              <View style={styles.statGrid}>
                <StatTile label="Titles" value={String(profile.totalAnime)} accent={tint} />
                <StatTile label="Completed" value={String(profile.completedCount)} accent="#22c55e" />
                <StatTile label="Mean score" value={`${profile.meanScore}`} accent="#fbbf24" />
                <StatTile label="Streak" value={`${profile.streak}d`} accent="#f472b6" />
                <StatTile label="Days watched" value={`${profile.totalDaysWatched}`} accent="#22d3ee" />
                <StatTile label="Planning" value={String(profile.planningCount)} accent="#818cf8" />
              </View>
            </FadeInView>

            {/* Watch style */}
            <FadeInView delay={90}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardEyebrow, { color: colors.textDim }]}>WATCH STYLE</Text>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {profile.watchStyle.emoji} {profile.watchStyle.label}
                </Text>
                <Text style={[styles.cardBody, { color: colors.textMuted }]}>{profile.watchStyle.note}</Text>
              </View>
            </FadeInView>

            {/* Top genres */}
            {profile.topGenres.length > 0 && (
              <FadeInView delay={120}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.cardEyebrow, { color: colors.textDim }]}>TOP GENRES</Text>
                  {profile.topGenres.map((g, i) => {
                    const accent = i === 0 ? fingerprint : i === 1 ? '#c084fc' : '#22d3ee';
                    return (
                      <View key={g.genre} style={styles.genreRow}>
                        <Text style={[styles.genreName, { color: colors.text }]} numberOfLines={1}>
                          {g.genre}
                        </Text>
                        <View style={[styles.genreTrack, { backgroundColor: `${accent}22` }]}>
                          <View
                            style={[
                              styles.genreFill,
                              { width: `${Math.max(6, Math.min(100, g.pct))}%`, backgroundColor: accent },
                            ]}
                          />
                        </View>
                        <Text style={[styles.genrePct, { color: accent }]}>{Math.round(g.pct)}%</Text>
                      </View>
                    );
                  })}
                </View>
              </FadeInView>
            )}

            {/* Genes */}
            {profile.genes.length > 0 && (
              <FadeInView delay={150}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.cardEyebrow, { color: colors.textDim }]}>GENE SEQUENCE</Text>
                  <View style={styles.geneWrap}>
                    {profile.genes.map((gene, i) => {
                      const c = geneColor(gene, tint);
                      return (
                        <View
                          key={`${gene}-${i}`}
                          style={[styles.geneChip, { borderColor: `${c}66`, backgroundColor: `${c}16` }]}
                        >
                          <View style={[styles.geneDot, { backgroundColor: c }]} />
                          <Text style={[styles.geneText, { color: c }]} numberOfLines={1}>
                            {geneLabel(gene)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </FadeInView>
            )}

            {/* Extras */}
            <FadeInView delay={180}>
              <View style={styles.miniRow}>
                <View style={[styles.miniCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.miniLabel, { color: colors.textDim }]}>FAVOURITE STUDIO</Text>
                  <Text style={[styles.miniValue, { color: colors.text }]} numberOfLines={2}>
                    {profile.favoriteStudio || 'Still undecided'}
                  </Text>
                </View>
                <View style={[styles.miniCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.miniLabel, { color: colors.textDim }]}>PEAK YEAR</Text>
                  <Text style={[styles.miniValue, { color: colors.text }]}>
                    {profile.peakYear || '—'}
                  </Text>
                </View>
              </View>
            </FadeInView>

            {profile.formats.length > 0 && (
              <FadeInView delay={200}>
                <View style={styles.formatRow}>
                  {profile.formats.slice(0, 5).map((f) => (
                    <View key={f} style={[styles.formatChip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                      <Text style={[styles.formatText, { color: colors.textMuted }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              </FadeInView>
            )}

            <Text style={[styles.footnote, { color: colors.textDim }]}>
              Derived from {profile.totalAnime} titles · ZyniVerse
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shareBtn: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 5 },
  shareText: { fontSize: 11, fontWeight: '900' },
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
  heroGlow: { position: 'absolute', right: -54, top: -60, width: 168, height: 168, borderRadius: 84 },
  heroGlowAlt: { position: 'absolute', left: -46, bottom: -66, width: 140, height: 140, borderRadius: 70 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatarRing: { borderWidth: 2, borderRadius: 26, padding: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1a1a2e' },
  heroName: { fontSize: 10.5, fontWeight: '700' },
  heroArchetype: { fontSize: 17, fontWeight: '900', lineHeight: 22, marginTop: 1 },
  fingerprint: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  fingerprintText: { color: '#0a0a0f', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  punchline: { fontSize: 12, fontWeight: '800', marginTop: 12 },
  blurb: { fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  statTile: {
    width: '31.5%',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  statValue: { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.6, marginTop: 2, textTransform: 'uppercase' },
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
  },
  cardEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '900' },
  cardBody: { fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  genreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  genreName: { width: 88, fontSize: 11, fontWeight: '800' },
  genreTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  genreFill: { height: 5, borderRadius: 3 },
  genrePct: { width: 34, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  geneWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  geneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  geneDot: { width: 5, height: 5, borderRadius: 3 },
  geneText: { fontSize: 10, fontWeight: '800', maxWidth: 130 },
  miniRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.md },
  miniCard: { flex: 1, borderWidth: 1, borderRadius: borderRadius.md, padding: 10 },
  miniLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  miniValue: { fontSize: 12.5, fontWeight: '800', marginTop: 4 },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.md, marginTop: spacing.md },
  formatChip: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  formatText: { fontSize: 10, fontWeight: '800' },
  footnote: { fontSize: 9, textAlign: 'center', marginTop: spacing.lg },
});
