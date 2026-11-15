import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { spacing, borderRadius } from '../theme';
import { Anime } from '../types';
import {
  animePoster,
  animeTitle,
  formatScore,
  getScoreColor,
  formatCount,
} from '../utils/helpers';

export type RailVariant = 'trending' | 'popular' | 'seasonal' | 'topRated' | 'upcoming';

interface VariantMeta {
  accent: string;
  accentAlt: string;
  eyebrow: string;
  emoji: string;
  width: number;
}

const VARIANTS: Record<RailVariant, VariantMeta> = {
  trending: { accent: '#f472b6', accentAlt: '#c084fc', eyebrow: 'HOT RIGHT NOW', emoji: '🔥', width: 146 },
  popular: { accent: '#c084fc', accentAlt: '#22d3ee', eyebrow: 'FAN FAVOURITES', emoji: '💜', width: 132 },
  seasonal: { accent: '#22d3ee', accentAlt: '#f472b6', eyebrow: 'AIRING THIS COUR', emoji: '🌸', width: 132 },
  topRated: { accent: '#fbbf24', accentAlt: '#f59e0b', eyebrow: 'HALL OF FAME', emoji: '🏆', width: 132 },
  upcoming: { accent: '#818cf8', accentAlt: '#22d3ee', eyebrow: 'COMING SOON', emoji: '🚀', width: 132 },
};

/** Seasonal tint that follows the calendar (independent of festival themes). */
function seasonAccent(): string {
  const m = new Date().getMonth();
  if (m === 11 || m <= 1) return '#7dd3fc'; // winter
  if (m <= 4) return '#f9a8d4'; // spring
  if (m <= 7) return '#fbbf24'; // summer
  return '#fb923c'; // autumn
}

function daysUntil(date?: { year?: number | null; month?: number | null; day?: number | null } | null) {
  if (!date?.year || !date?.month || !date?.day) return null;
  const target = Date.UTC(date.year, date.month - 1, date.day);
  const now = Date.now();
  const diff = Math.ceil((target - now) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

function countdownLabel(anime: Anime): string | null {
  const next = anime.nextAiringEpisode;
  if (next?.airingAt) {
    const secs = next.airingAt * 1000 - Date.now();
    if (secs <= 0) return 'AIRING NOW';
    const hours = Math.floor(secs / 3600000);
    if (hours < 24) return `EP ${next.episode} IN ${Math.max(1, hours)}H`;
    return `EP ${next.episode} IN ${Math.floor(hours / 24)}D`;
  }
  const days = daysUntil(anime.startDate);
  if (days === null) return 'DATE TBA';
  if (days <= 0) return 'OUT NOW';
  if (days === 1) return 'TOMORROW';
  if (days < 30) return `IN ${days} DAYS`;
  return `IN ${Math.round(days / 30)} MONTHS`;
}

function airingProgress(anime: Anime): number {
  if (!anime.episodes) return 0;
  const next = anime.nextAiringEpisode?.episode;
  const aired = next ? next - 1 : anime.status === 'FINISHED' ? anime.episodes : 0;
  return Math.min(1, Math.max(0, aired / anime.episodes));
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function RailCard({
  anime,
  index,
  variant,
  accent,
  accentAlt,
}: {
  anime: Anime;
  index: number;
  variant: RailVariant;
  accent: string;
  accentAlt: string;
}) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const meta = VARIANTS[variant];
  const width = meta.width;
  const title = animeTitle(anime);
  const image = animePoster(anime);
  const score = anime.averageScore;

  const [imgError, setImgError] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const imgOpacity = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      delay: Math.min(index, 7) * 65,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.955] });

  return (
    <Animated.View
      style={{
        width,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
          { scale: Animated.multiply(enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }), scale) },
        ],
      }}
    >
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={() =>
            Animated.spring(press, { toValue: 0, speed: 40, bounciness: 0, useNativeDriver: true }).start()
          }
          onPressOut={() =>
            Animated.spring(press, { toValue: 1, speed: 24, bounciness: 6, useNativeDriver: true }).start()
          }
          onPress={() => navigation.navigate('AnimeDetail', { id: anime.id, title })}
        >
          <View
            style={[
              styles.poster,
              {
                height: width * 1.46,
                backgroundColor: colors.surface,
                borderColor: `${accent}44`,
              },
            ]}
          >
            {image && !imgError ? (
              <Animated.Image
                source={{ uri: image }}
                style={[styles.posterImage, { opacity: imgOpacity }]}
                resizeMode="cover"
                onLoad={() =>
                  Animated.timing(imgOpacity, {
                    toValue: 1,
                    duration: 300,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                  }).start()
                }
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={[styles.posterFallback, { backgroundColor: colors.surfaceLight }]}>
                <Text style={{ fontSize: 22, color: colors.textDim }}>?</Text>
              </View>
            )}

            {/* Readability scrims (no gradient lib — layered translucent views). */}
            <View pointerEvents="none" style={[styles.scrim, { height: '42%', opacity: 0.34 }]} />
            <View pointerEvents="none" style={[styles.scrim, { height: '26%', opacity: 0.34 }]} />

            {/* Top-left badge */}
            {variant === 'trending' && (
              <View style={[styles.rankBadge, { backgroundColor: accent }]}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
            )}
            {variant === 'topRated' && (
              <View style={[styles.rankBadge, { backgroundColor: 'rgba(10,10,15,0.72)', borderColor: `${accent}88` }]}>
                <Text style={[styles.rankText, { color: accent }]}>🏅 #{index + 1}</Text>
              </View>
            )}
            {variant === 'seasonal' && anime.status === 'RELEASING' && (
              <View style={[styles.livePill, { backgroundColor: '#ef4444' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>NOW</Text>
              </View>
            )}
            {variant === 'upcoming' && (
              <View style={[styles.rankBadge, { backgroundColor: 'rgba(10,10,15,0.75)', borderColor: `${accent}88` }]}>
                <Text style={[styles.rankText, { color: accent }]}>SOON</Text>
              </View>
            )}

            {/* Top-right score */}
            {score ? (
              <View style={[styles.scorePill, { backgroundColor: getScoreColor(score) }]}>
                <Text style={styles.scoreText}>{formatScore(score)}</Text>
              </View>
            ) : null}

            {/* Bottom overlay, per variant */}
            <View style={styles.bottomOverlay}>
              {variant === 'popular' && (
                <View style={styles.heatRow}>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const pop = anime.popularity || 0;
                    const filled = pop > 0 && i <= Math.min(4, Math.floor(Math.log10(pop + 1) * 1.15) - 1);
                    return (
                      <View
                        key={i}
                        style={[
                          styles.heatBar,
                          {
                            height: 5 + i * 2,
                            backgroundColor: filled ? accent : `${accent}33`,
                          },
                        ]}
                      />
                    );
                  })}
                  <Text style={[styles.heatText, { color: accent }]}>
                    {formatCount(anime.popularity)} fans
                  </Text>
                </View>
              )}

              {variant === 'topRated' && (
                <View>
                  <View style={[styles.meterTrack, { backgroundColor: `${accent}33` }]}>
                    <View
                      style={[
                        styles.meterFill,
                        { width: `${Math.min(100, Math.max(4, (score || 0) / 100 * 100))}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                  <Text style={[styles.overlayCaption, { color: accent }]}>
                    {score ? `${(score / 10).toFixed(2)} / 10` : 'NO SCORE'}
                  </Text>
                </View>
              )}

              {variant === 'seasonal' && (
                <View>
                  <View style={[styles.meterTrack, { backgroundColor: `${accent}33` }]}>
                    <View
                      style={[styles.meterFill, { width: `${airingProgress(anime) * 100}%`, backgroundColor: accent }]}
                    />
                  </View>
                  <Text style={[styles.overlayCaption, { color: accent }]} numberOfLines={1}>
                    {anime.episodes
                      ? `EP ${Math.max(0, (anime.nextAiringEpisode?.episode || anime.episodes + 1) - 1)} / ${anime.episodes}`
                      : 'AIRING'}
                  </Text>
                </View>
              )}

              {variant === 'upcoming' && (
                <View style={[styles.countdownPill, { borderColor: `${accent}66`, backgroundColor: 'rgba(10,10,15,0.6)' }]}>
                  <Text style={[styles.countdownText, { color: accent }]} numberOfLines={1}>
                    ⏳ {countdownLabel(anime)}
                  </Text>
                </View>
              )}

              {variant === 'trending' && (
                <View style={[styles.meterTrack, { backgroundColor: `${accentAlt}33` }]}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        width: `${Math.min(100, Math.max(8, (anime.trending || anime.popularity || 0) > 0 ? 100 - index * 8 : 10))}%`,
                        backgroundColor: accent,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.meta, { color: colors.textDim }]} numberOfLines={1}>
            {[
              anime.format,
              anime.episodes ? `${anime.episodes} eps` : null,
              anime.seasonYear,
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Rail                                                                */
/* ------------------------------------------------------------------ */

interface Props {
  title: string;
  anime: Anime[];
  variant: RailVariant;
  subtitle?: string;
  onSeeAll?: () => void;
  /** Override the automatic accent (used by seasonal festival skins). */
  accent?: string;
}

export default function ShowcaseRail({ title, anime, variant, subtitle, onSeeAll, accent }: Props) {
  const { colors } = useTheme();
  const meta = VARIANTS[variant];
  const tint = accent || (variant === 'seasonal' ? seasonAccent() : meta.accent);
  const tintAlt = meta.accentAlt;
  const header = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(header, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [header, shimmer]);

  if (!anime || anime.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.rail,
        {
          opacity: header,
          transform: [{ translateY: header.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.accentBar, { backgroundColor: tint }]}>
          <Animated.View
            style={[
              styles.accentBarGlow,
              {
                backgroundColor: tintAlt,
                opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.65] }),
              },
            ]}
          />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: tint }]}>
              {meta.emoji} {meta.eyebrow}
            </Text>
          </View>
          <Text style={[styles.railTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.railSubtitle, { color: colors.textDim }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {onSeeAll && (
          <TouchableOpacity
            onPress={onSeeAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.seeAll, { borderColor: `${tint}55`, backgroundColor: `${tint}14` }]}
          >
            <Text style={[styles.seeAllText, { color: tint }]}>See all</Text>
            <Text style={[styles.seeAllArrow, { color: tint }]}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {anime.map((item, i) => (
          <RailCard key={item.id} anime={item} index={i} variant={variant} accent={tint} accentAlt={tintAlt} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  accentBar: {
    width: 4,
    height: 34,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  accentBarGlow: {
    width: '100%',
    height: '55%',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  railTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  railSubtitle: {
    fontSize: 10.5,
    marginTop: 1,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  seeAllText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  seeAllArrow: {
    fontSize: 11,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: 10,
    paddingBottom: 4,
  },
  poster: {
    width: '100%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#05060d',
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rankText: {
    color: '#0a0a0f',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  livePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  livePillText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scorePill: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  scoreText: {
    color: '#0a0a0f',
    fontSize: 10,
    fontWeight: '900',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 7,
  },
  heatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  heatBar: {
    width: 6,
    borderRadius: 2,
  },
  heatText: {
    fontSize: 8.5,
    fontWeight: '800',
    marginLeft: 4,
    marginBottom: 1,
  },
  meterTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  meterFill: {
    height: 3,
    borderRadius: 2,
  },
  overlayCaption: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  countdownPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  countdownText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 7,
    lineHeight: 17,
  },
  meta: {
    fontSize: 10,
    marginTop: 2,
  },
});
