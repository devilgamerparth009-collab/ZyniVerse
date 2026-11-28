import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, themed, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useAnime } from '../hooks/useAnime';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorView from '../components/ErrorView';
import FillerProgress from '../components/FillerProgress';
import SafeImage from '../components/SafeImage';
import AdBanner from '../components/AdBanner';
import { formatScore, getScoreColor, LIST_STATUS_LABEL } from '../utils/helpers';
import { openSafeWebUrl, openTrustedExternalUrl, platformLabelForUrl, trustedExternalUrl } from '../utils/safeLinks';
import { api, getCurrentUser, StreamingLink } from '../services/api';
import {
  Anime,
  CharacterEdge,
  DubStatus,
  FillerData,
  ReviewItem,
  WatchlistItem,
} from '../types';
import { DubLanguage, getPreferredDubLanguage } from '../services/prefs';

const SCREEN_WIDTH = Dimensions.get('window').width;

const STATUS_OPTIONS = ['CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED', 'REWATCHING'];

function cleanDescription(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function DubRow({
  label,
  available,
  color,
  preferred,
}: {
  label: string;
  available: boolean;
  color: string;
  preferred: boolean;
}) {
  return (
    <View
      style={[
        styles.dubBadge,
        {
          borderColor: available ? color : colors.border,
          backgroundColor: preferred && available ? `${color}22` : 'transparent',
        },
      ]}
    >
      <Text style={[styles.dubText, { color: available ? color : colors.textDim }]}>
        {label} {available ? '✓' : '✕'}
        {preferred && available ? ' · preferred' : ''}
      </Text>
    </View>
  );
}

export default function AnimeDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isLaunch } = useTheme();
  const primaryAccent = isLaunch ? '#22d3ee' : colors.primary;
  const id: number = route.params?.id;
  const { data: anime, loading, error, refetch } = useAnime(id);

  const [loggedIn, setLoggedIn] = useState(false);
  const [entry, setEntry] = useState<WatchlistItem | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [characters, setCharacters] = useState<CharacterEdge[]>([]);
  const [recs, setRecs] = useState<Anime[]>([]);
  const [dub, setDub] = useState<DubStatus | null>(null);
  const [filler, setFiller] = useState<FillerData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [preferredDub, setPreferredDub] = useState<DubLanguage | null>(null);
  const [streamingLinks, setStreamingLinks] = useState<StreamingLink[]>([]);

  const [reviewRating, setReviewRating] = useState(8);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const malId = anime?.idMal || anime?.malId || undefined;
  const title =
    anime?.title?.english || anime?.title?.romaji || anime?.title?.userPreferred || 'Anime';
  // Alternate titles are sent to the shared filler API so a title-only fallback
  // can still find a guide when ids differ between catalogues.
  const fillerAliases = useMemo(
    () =>
      [anime?.title?.romaji, anime?.title?.english, anime?.title?.native, anime?.title?.userPreferred]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    [anime]
  );
  const poster =
    anime?.coverImage?.extraLarge || anime?.coverImage?.large || anime?.coverImage?.medium;
  const totalEpisodes = anime?.episodes || 0;

  const loadEntry = useCallback(async () => {
    const user = await getCurrentUser().catch(() => null);
    setLoggedIn(!!user);
    if (!user) {
      setEntry(null);
      return;
    }
    try {
      const items = await api.watchlist.get();
      setEntry(items.find((i) => i.mediaId === id) || null);
    } catch {
      setEntry(null);
    }
  }, [id]);

  useEffect(() => {
    loadEntry();
    getPreferredDubLanguage().then(setPreferredDub).catch(() => {});
  }, [loadEntry]);

  useEffect(() => {
    api.characters(id, 1).then((res) => setCharacters(res.edges.slice(0, 18))).catch(() => {});
    api.reviews.list(id).then(setReviews).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!anime) return;
    // Pass every identifier we know so the shared API can try strict AniList
    // id, then MAL id, then normalised title/alias matching.
    api.filler
      .get({ anilistId: id, malId, title, aliases: fillerAliases })
      .then(setFiller)
      .catch(() => setFiller(null));
  }, [id, anime, title, malId, fillerAliases]);

  // Genre-based recommendations once the anime (and its genres) load.
  useEffect(() => {
    const genre = anime?.genres?.[0];
    if (!genre) return;
    api
      .recommendations(genre, 12)
      .then((list) => setRecs(list.filter((a) => a.id !== id).slice(0, 12)))
      .catch(() => setRecs([]));
  }, [anime?.genres?.[0], id]);

  // Dub availability is keyed by MyAnimeList id.
  useEffect(() => {
    if (!malId) {
      setDub(null);
      return;
    }
    api.dubStatus.get(malId).then(setDub).catch(() => setDub(null));
  }, [malId]);

  // AniList direct links are best; fall back to official platform searches.
  useEffect(() => {
    if (!anime) return;
    const direct = (anime.streamingEpisodes || [])
      .map((ep) => trustedExternalUrl(ep.url))
      .filter(Boolean) as string[];
    if (direct.length > 0) {
      setStreamingLinks([]);
      return;
    }
    api.streaming
      .links(id, title)
      .then((links) => setStreamingLinks(links.slice(0, 8)))
      .catch(() => setStreamingLinks([]));
  }, [anime, id, title]);

  const setStatus = async (status: string) => {
    if (!loggedIn) {
      navigation.navigate('Login');
      return;
    }
    if (listBusy) return;
    setListBusy(true);
    try {
      await api.watchlist.add({
        mediaId: id,
        status,
        type: anime?.type === 'MANGA' ? 'MANGA' : 'ANIME',
        mediaTitle: title,
        mediaImage: poster || undefined,
      });
      await loadEntry();
    } catch (e: any) {
      Alert.alert('Could not update list', e?.message || 'Please try again.');
    } finally {
      setListBusy(false);
    }
  };

  const removeEntry = async () => {
    if (listBusy) return;
    setListBusy(true);
    try {
      await api.watchlist.remove(id);
      setEntry(null);
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message || 'Please try again.');
    } finally {
      setListBusy(false);
    }
  };

  const changeProgress = async (delta: number) => {
    if (!loggedIn) {
      navigation.navigate('Login');
      return;
    }
    if (!entry || listBusy) return;
    const max = entry.total || totalEpisodes || 0;
    const next = Math.max(0, Math.min(max > 0 ? max : 9999, (entry.progress || 0) + delta));
    if (next === entry.progress) return;
    setListBusy(true);
    const previous = entry;
    setEntry({ ...entry, progress: next });
    try {
      await api.watchlist.edit({ mediaId: id, progress: next, total: max || undefined });
      if (delta > 0) {
        await api.track.episode({
          mediaId: id,
          episode: next,
          title,
          totalEpisodes: max || undefined,
        });
      }
      await loadEntry();
    } catch (e: any) {
      setEntry(previous);
      Alert.alert('Could not update progress', e?.message || 'Please try again.');
    } finally {
      setListBusy(false);
    }
  };

  const rate = async (score: number) => {
    if (!loggedIn) {
      navigation.navigate('Login');
      return;
    }
    if (listBusy) return;
    setListBusy(true);
    try {
      await api.watchlist.rate(id, score, anime?.type === 'MANGA' ? 'MANGA' : 'ANIME');
      await loadEntry();
    } catch (e: any) {
      Alert.alert('Could not rate', e?.message || 'Please try again.');
    } finally {
      setListBusy(false);
    }
  };

  const submitReview = async () => {
    if (!loggedIn) {
      navigation.navigate('Login');
      return;
    }
    if (submittingReview) return;
    setSubmittingReview(true);
    try {
      await api.reviews.submit({
        mediaId: id,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
        mediaTitle: title,
        mediaImage: poster || undefined,
      });
      setReviewComment('');
      const list = await api.reviews.list(id);
      setReviews(list);
      Alert.alert('Review posted', 'Thanks for sharing your thoughts!');
    } catch (e: any) {
      Alert.alert('Could not post review', e?.message || 'Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const openTrailer = async () => {
    if (!anime) return;
    const site = (anime.trailer?.site || '').toLowerCase();
    const trailerId = anime.trailer?.id;
    if (site === 'youtube' && trailerId) {
      const opened = await openTrustedExternalUrl(`https://www.youtube.com/watch?v=${trailerId}`);
      if (opened) return;
    }
    Alert.alert('Trailer', 'An official trailer link is not available yet.');
  };

  const description = useMemo(() => cleanDescription(anime?.description), [anime?.description]);

  const studios = useMemo(() => {
    if (!anime?.studios) return [];
    if (Array.isArray(anime.studios)) return anime.studios.map((s) => s.name);
    return (anime.studios.nodes || []).map((s) => s.name);
  }, [anime?.studios]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (error || !anime) {
    return <ErrorView message={error || 'Anime not found'} onRetry={refetch} />;
  }

  const score = anime.averageScore || anime.meanScore || 0;
  const progressPct =
    entry && (entry.total || totalEpisodes) > 0
      ? Math.min(100, (entry.progress / (entry.total || totalEpisodes)) * 100)
      : 0;
  const nextEp = anime.nextAiringEpisode;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <SafeImage
          uri={anime.bannerImage || poster}
          fallbackLabel={title}
          style={styles.heroImage}
          blurRadius={anime.bannerImage ? undefined : 2}
          accessibilityLabel={title}
        />
        <View style={styles.heroOverlay} />
      </View>

      <View style={styles.headerCard}>
        <SafeImage
          uri={poster}
          fallbackLabel={title}
          style={styles.poster}
          accessibilityLabel={title}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaRow}>
            {anime.format ? <Text style={styles.metaChip}>{anime.format}</Text> : null}
            {anime.seasonYear ? <Text style={styles.metaText}>{anime.seasonYear}</Text> : null}
            {anime.episodes ? <Text style={styles.metaText}>{anime.episodes} eps</Text> : null}
            {anime.status ? (
              <Text style={styles.metaText}>{anime.status.replace(/_/g, ' ')}</Text>
            ) : null}
          </View>
          <View style={styles.scoreRow}>
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(score) }]}>
              <Text style={styles.scoreBadgeText}>★ {formatScore(score)}</Text>
            </View>
            {anime.popularity ? (
              <Text style={styles.popularity}>{anime.popularity.toLocaleString()} members</Text>
            ) : null}
          </View>
          {nextEp ? (
            <Text style={styles.nextEp}>
              Next: Episode {nextEp.episode} ·{' '}
              {new Date(nextEp.airingAt * 1000).toLocaleString(undefined, {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your List</Text>
        {!loggedIn ? (
          <TouchableOpacity
            style={styles.signInPrompt}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.signInPromptText}>Sign in to track this anime →</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusScroll}
            >
              {STATUS_OPTIONS.map((status) => {
                const active = entry?.status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusChip, active && styles.statusChipActive]}
                    onPress={() => setStatus(status)}
                    disabled={listBusy}
                  >
                    <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                      {LIST_STATUS_LABEL[status]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {entry ? (
              <View style={styles.trackerCard}>
                <View style={styles.trackerHeader}>
                  <Text style={styles.trackerLabel}>
                    Progress · {entry.progress}
                    {entry.total ? ` / ${entry.total}` : ''}
                  </Text>
                  <TouchableOpacity onPress={removeEntry} disabled={listBusy}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <View style={styles.progressActions}>
                  <TouchableOpacity
                    style={styles.progressButton}
                    onPress={() => changeProgress(-1)}
                    disabled={listBusy || entry.progress <= 0}
                  >
                    <Text style={styles.progressButtonText}>'</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.progressButton, styles.progressButtonPrimary]}
                    onPress={() => changeProgress(1)}
                    disabled={listBusy}
                  >
                    <Text style={[styles.progressButtonText, styles.progressButtonTextPrimary]}>
                      +1 Episode
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.ratingLabel}>
                  Your rating{entry.score ? ` · ${entry.score}/10` : ''}
                </Text>
                <View style={styles.ratingRow}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const active = entry.score === n;
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[styles.ratingDot, active && styles.ratingDotActive]}
                        onPress={() => rate(n)}
                        disabled={listBusy}
                      >
                        <Text style={[styles.ratingDotText, active && styles.ratingDotTextActive]}>
                          {n}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.mutedText}>
                Pick a status above to add this to your list.
              </Text>
            )}
          </View>
        )}
      </View>

      {description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      ) : null}

      {/* In-content 300x250 Medium Ad Banner */}
      <AdBanner size="medium" placement="detail-inline" />

      {anime.genres && anime.genres.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Genres</Text>
          <View style={styles.genreWrap}>
            {anime.genres.map((genre) => (
              <TouchableOpacity
                key={genre}
                style={styles.genreChip}
                onPress={() => navigation.navigate('Browse', { genre, title: genre })}
              >
                <Text style={styles.genreText}>{genre}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {studios.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Studio</Text>
          <Text style={styles.mutedText}>{studios.join(', ')}</Text>
        </View>
      ) : null}

      <View style={styles.actionGrid}>
        {anime.trailer?.id ? (
          <TouchableOpacity style={styles.actionCard} onPress={openTrailer}>
            <Text style={styles.actionIcon}>▶</Text>
            <Text style={styles.actionLabel}>Trailer</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('FillerGuide', {
              id: anime.id,
              title,
              image: poster,
              malId,
              aliases: fillerAliases,
            })
          }
        >
          <Text style={styles.actionIcon}>⚡</Text>
          <Text style={styles.actionLabel}>Filler Guide</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('ThreadList', { animeId: anime.id, animeTitle: title })
          }
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionLabel}>Discuss</Text>
        </TouchableOpacity>
      </View>

      {filler && filler.episodes.length > 0 && filler.totalFillers > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Filler</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('FillerGuide', {
                  id: anime.id,
                  title,
                  image: poster,
                  malId,
                  aliases: fillerAliases,
                })
              }
            >
              <Text style={styles.seeAll}>Full guide →</Text>
            </TouchableOpacity>
          </View>
          <FillerProgress
            totalEpisodes={filler.totalEpisodes}
            totalFillers={filler.totalFillers}
            fillerPercentage={filler.fillerPercentage}
          />
        </View>
      ) : null}

      {dub ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dub Availability</Text>
          <View style={styles.dubWrap}>
            <DubRow
              label="English"
              available={!!dub.english?.available}
              color="#22d3ee"
              preferred={preferredDub === 'english'}
            />
            <DubRow
              label="Hindi"
              available={!!dub.hindi?.available}
              color="#f97316"
              preferred={preferredDub === 'hindi'}
            />
            <DubRow
              label="Tamil"
              available={!!dub.tamil?.available}
              color="#dc2626"
              preferred={preferredDub === 'tamil'}
            />
            <DubRow
              label="Telugu"
              available={!!dub.telugu?.available}
              color="#2563eb"
              preferred={preferredDub === 'telugu'}
            />
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.dubSettingsLink}>Change preferred language in Settings →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {anime.streamingEpisodes && anime.streamingEpisodes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Where to Watch</Text>
          <Text style={styles.mutedText}>
            Official platforms where episodes are available. Tap to open directly.
          </Text>
          <View style={styles.watchList}>
            {anime.streamingEpisodes.slice(0, 12).map((ep, idx) => {
              const trusted = trustedExternalUrl(ep.url);
              const platform = platformLabelForUrl(ep.url);
              return (
                <TouchableOpacity
                  key={`${ep.url}-${idx}`}
                  style={styles.watchRow}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (trusted) {
                      openTrustedExternalUrl(trusted).catch(() => {});
                    } else {
                      Alert.alert('Watch link', 'An official watch link is not available for this platform yet.');
                    }
                  }}
                >
                  <View style={styles.watchRowBody}>
                    <Text style={styles.watchPlatform}>{platform}</Text>
                    <Text style={styles.watchTitle} numberOfLines={2}>
                      {ep.title || 'Watch episode'}
                    </Text>
                  </View>
                  <Text style={styles.watchAction}>{trusted ? 'Open →' : 'Unavailable'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {streamingLinks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Find it on official platforms</Text>
          <Text style={styles.mutedText}>
            No direct episode link was published for this title. These searches stay on official services.
          </Text>
          <View style={styles.watchList}>
            {streamingLinks.map((link) => (
              <TouchableOpacity
                key={`${link.platform}-${link.url}`}
                style={styles.watchRow}
                activeOpacity={0.85}
                onPress={() => openTrustedExternalUrl(link.url).catch(() => {})}
              >
                <View style={styles.watchRowBody}>
                  <Text style={styles.watchPlatform}>{link.platform}</Text>
                  <Text style={styles.watchTitle} numberOfLines={1}>
                    {platformLabelForUrl(link.url)}
                  </Text>
                </View>
                <Text style={styles.watchAction}>
                  {link.kind === 'search' ? 'Search →' : 'Open →'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {characters.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Characters</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.charScroll}
          >
            {characters.map((edge) => {
              const image = edge.node.image?.large || edge.node.image?.medium;
              const va = edge.voiceActors?.[0];
              return (
                <View key={edge.node.id} style={styles.charCard}>
                  <SafeImage
                    uri={image}
                    fallbackLabel={edge.node.name?.full || 'Character'}
                    style={styles.charImage}
                  />
                  <Text style={styles.charName} numberOfLines={2}>
                    {edge.node.name?.full || 'Unknown'}
                  </Text>
                  <Text style={styles.charRole} numberOfLines={1}>
                    {edge.role || ''}
                  </Text>
                  {va?.name?.full ? (
                    <Text style={styles.charVa} numberOfLines={1}>
                      {va.name.full}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {loggedIn ? (
          <View style={styles.reviewForm}>
            <Text style={styles.ratingLabel}>Rate {reviewRating}/10</Text>
            <View style={styles.ratingRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const active = reviewRating === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.ratingDot, active && styles.ratingDotActive]}
                    onPress={() => setReviewRating(n)}
                  >
                    <Text style={[styles.ratingDotText, active && styles.ratingDotTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Share your thoughts (optional)›¦"
              placeholderTextColor={colors.textDim}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reviewButton, submittingReview && { opacity: 0.6 }]}
              onPress={submitReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#0a0a0f" />
              ) : (
                <Text style={styles.reviewButtonText}>Post Review</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signInPrompt}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.signInPromptText}>Sign in to write a review →</Text>
          </TouchableOpacity>
        )}

        {reviews.length === 0 ? (
          <Text style={styles.mutedText}>No reviews yet. Be the first!</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewUser}>@{review.user?.username || 'user'}</Text>
                <Text style={styles.reviewScore}>★ {review.rating}/10</Text>
              </View>
              {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
              <Text style={styles.reviewTime}>
                {new Date(review.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </View>

      {recs.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Like This</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recScroll}
          >
            {recs.map((rec) => {
              const recPoster =
                rec.coverImage?.large || rec.coverImage?.medium || rec.coverImage?.extraLarge;
              const recTitle = rec.title?.english || rec.title?.romaji || 'Anime';
              return (
                <TouchableOpacity
                  key={rec.id}
                  style={styles.recCard}
                  onPress={() => navigation.push('AnimeDetail', { id: rec.id, title: recTitle })}
                >
                  <SafeImage
                    uri={recPoster}
                    fallbackLabel={recTitle}
                    style={styles.recImage}
                    accessibilityLabel={recTitle}
                  />
                  <Text style={styles.recTitle} numberOfLines={2}>
                    {recTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

    </ScrollView>
  );
}

const styles = themed(() => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    height: 220,
    width: SCREEN_WIDTH,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.35)',
  },
  headerCard: {
    flexDirection: 'row',
    marginTop: -70,
    paddingHorizontal: spacing.md,
  },
  poster: {
    width: 110,
    height: 158,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.background,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderText: {
    color: colors.textDim,
    fontSize: fontSize.xl,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.md,
    paddingTop: 78,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaChip: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  metaText: {
    color: colors.textDim,
    fontSize: fontSize.xs,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  scoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  scoreBadgeText: {
    color: '#0a0a0f',
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  popularity: {
    color: colors.textDim,
    fontSize: fontSize.xs,
  },
  nextEp: {
    color: colors.primary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAll: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 21,
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  genreText: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  mutedText: {
    color: colors.textDim,
    fontSize: fontSize.sm,
  },
  signInPrompt: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.35)',
  },
  signInPromptText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statusScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  trackerCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  trackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackerLabel: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  removeText: {
    color: colors.error,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceLight,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  progressButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    flex: 2,
  },
  progressButtonText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  progressButtonTextPrimary: {
    color: '#0a0a0f',
  },
  ratingLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  ratingDot: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingDotActive: {
    backgroundColor: colors.primary,
  },
  ratingDotText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  ratingDotTextActive: {
    color: '#0a0a0f',
    fontWeight: '800',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  actionIcon: {
    color: colors.primary,
    fontSize: 18,
    marginBottom: 2,
  },
  actionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  dubWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dubBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dubText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  dubSettingsLink: {
    color: colors.textDim,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  watchList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  watchRowBody: {
    flex: 1,
  },
  watchPlatform: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  watchTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
  },
  watchAction: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  charScroll: {
    gap: spacing.sm,
  },
  charCard: {
    width: 96,
  },
  charImage: {
    width: 96,
    height: 128,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  charName: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  charRole: {
    color: colors.primary,
    fontSize: 10,
    marginTop: 1,
  },
  charVa: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  reviewForm: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  reviewInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.md,
    minHeight: 80,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  reviewButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  reviewButtonText: {
    color: '#0a0a0f',
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  reviewCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  reviewUser: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  reviewScore: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  reviewText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  reviewTime: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  recScroll: {
    gap: spacing.sm,
  },
  recCard: {
    width: 104,
  },
  recImage: {
    width: 104,
    height: 148,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  recTitle: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: spacing.xs,
    lineHeight: 16,
  },
}));
