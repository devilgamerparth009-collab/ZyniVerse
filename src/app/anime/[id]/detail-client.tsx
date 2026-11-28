"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { bestTitle } from "@/lib/anilist";
import CountdownChip from "@/components/CountdownChip";
import { useWatchlist } from "@/components/WatchlistProvider";
import { DynamicHorizontalScroll as HorizontalScroll } from "@/components/lazy";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FadeIn, StaggerGrid, StaggerItem, PageTransition } from "@/components/PageTransition";
import RevealTitle from "@/components/RevealTitle";
import FillerGuide from "@/components/FillerGuide";
import ReviewsSection from "@/components/ReviewsSection";
import WhereToWatch from "@/components/WhereToWatch";
import PlayAsiaPill from "@/components/PlayAsiaPill";
import TvScheduleCard from "@/components/TvScheduleCard";
import EpisodeTracker from "@/components/EpisodeTracker";
import AnimeRatingInput from "@/components/AnimeRatingInput";
import AdBanner from "@/components/AdBanner";
import ForumDiscussionWidget from "@/components/ForumDiscussionWidget";
import ThemeSongsSection from "@/components/features/ThemeSongsSection";
import ScoreDistributionChart from "@/components/features/ScoreDistributionChart";
import UsersAlsoLiked from "@/components/features/UsersAlsoLiked";
import MetadataPanel from "@/components/MetadataPanel";
import CommunityTagPanel from "@/components/CommunityTagPanel";
import ShareButton from "@/components/ShareButton";
import MomentMaker from "@/components/MomentMaker";
import RecRelationships from "@/components/RecRelationships";
import FanRecommendations from "@/components/features/FanRecommendations";
import CharacterVoteWidget from "@/components/CharacterVoteWidget";
import CalendarSync from "@/components/CalendarSync";
import EpisodeRatingsCard from "@/components/EpisodeRatingsCard";
import EpisodeDiscussion from "@/components/EpisodeDiscussion";
import DubNotifyButton from "@/components/DubNotifyButton";
import AnimeFollowButton from "@/components/AnimeFollowButton";
import LongReviews from "@/components/LongReviews";
import AiLab from "@/components/features/AiLab";
import IndianDubCast from "@/components/IndianDubCast";
import AiringAlertButton from "@/components/AiringAlertButton";
import type { MediaAnimeFull } from "@/lib/anilist";
import type { AnimeEditorial } from "@/lib/anime-editorials";
import boxStyles from "@/components/detailBoxes.module.css";
import styles from "./anime-detail.module.css";

interface AnimeReelLink {
  id: string;
  thumbnailUrl: string | null;
  caption: string | null;
  views: number;
  duration: number;
  likesCount: number;
  username: string;
}

const DUB_LANG_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  English: { bg: "#3b82f622", text: "#3b82f6", border: "#3b82f644" },
  Hindi: { bg: "#ff993322", text: "#ff9933", border: "#ff993344" },
  Tamil: { bg: "#e84a5f22", text: "#e84a5f", border: "#e84a5f44" },
  Telugu: { bg: "#6c63ff22", text: "#6c63ff", border: "#6c63ff44" },
  Malayalam: { bg: "#14b8a622", text: "#14b8a6", border: "#14b8a644" },
  Bengali: { bg: "#f9731622", text: "#f97316", border: "#f9731644" },
};

const STAFF_ACCENTS = ["#22d3ee", "#f472b6", "#fbbf24", "#a78bfa"];

function initialOf(name?: string | null) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function stripHtml(str: string | null | undefined = "") {
  return str ? str.replace(/<[^>]*>/g, "") : "";
}
function formatScore(score?: number) {
  return score ? (score / 10).toFixed(1) : "—";
}

export default function AnimeDetailClient({
  anime,
  editorial,
  reels = [],
  dubGuideHref = null,
}: {
  anime: MediaAnimeFull;
  editorial?: AnimeEditorial | null;
  reels: AnimeReelLink[];
  dubGuideHref?: string | null;
}) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [momentMakerOpen, setMomentMakerOpen] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [dubLangsById, setDubLangsById] = useState<
    Record<number, string[] | null>
  >({});
  const [failedBanner, setFailedBanner] = useState("");
  const { isSaved, toggle } = useWatchlist();
  const title = bestTitle(anime.title);
  // Hero shows the official English title on top, readable romaji below it.
  const heroTitle = anime.title?.english || title;
  const heroSubtitle =
    anime.title?.romaji && anime.title.romaji !== heroTitle
      ? anime.title.romaji
      : null;

  useEffect(() => {
    if (anime.idMal) {
      const titleCandidates = [
        title,
        anime.title?.romaji,
        anime.title?.english,
        anime.title?.native,
      ]
        .filter((value): value is string => Boolean(value))
        .filter((value, index, all) => all.indexOf(value) === index)
        .slice(0, 3);
      fetch(
        `/api/anime-dub-status?malId=${anime.idMal}&anilistId=${anime.id}&titles=${encodeURIComponent(titleCandidates.join("|"))}`,
      )
        .then((r) => r.json())
        .then((res) => {
          if (res.success)
            setDubLangsById((prev) => ({ ...prev, [anime.id]: res.available }));
        })
        .catch(() => {});
    }
  }, [anime.id, anime.idMal, anime.title, title]);

  const dubLangs = dubLangsById[anime.id] ?? null;

  const saved = isSaved(anime.id);
  const chars = anime.characters?.edges || [];
  const staffEdges = anime.staff?.edges || [];
  const links = (anime.externalLinks || []).filter((l) => !l.isDisabled);
  const streamingLinks = links.filter((l) => l.type === "STREAMING");
  const relations = (anime.relations?.edges || []).filter((e) =>
    [
      "SEQUEL",
      "PREQUEL",
      "SIDE_STORY",
      "ALTERNATIVE",
      "SUMMARY",
      "ADAPTATION",
      "SOURCE",
    ].includes(e.relationType),
  );
  const recs = anime.recommendations?.edges || [];
  const recommendedItems = recs
    .map((e) => e.node.mediaRecommendation)
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const rankings = anime.rankings || [];
  const scoreDist = anime.stats?.scoreDistribution || [];

  const heroChar = chars[0]?.node;
  const heroCharImage = heroChar?.image?.large;
  const heroCharName = heroChar?.name?.full;
  const coverArt =
    anime.coverImage?.extraLarge || anime.coverImage?.large || "";
  const bannerSrc = anime.bannerImage || "";
  const bannerFailed = Boolean(bannerSrc) && failedBanner === bannerSrc;
  const heroBackdrop = (!bannerFailed && bannerSrc) || coverArt;
  const heroBackdropIsCover = !bannerSrc || bannerFailed;

  return (
    <PageTransition>
      <ErrorBoundary label="AnimeDetails">
        <div>
          {/* ── Hero ── */}
          <div
            className={styles.hero}
            style={
              {
                "--hero-accent": anime.coverImage?.color || "#ff2d78",
              } as CSSProperties
            }
          >
            {/* Background banner, with cover art fallback when a banner is missing or broken */}
            {heroBackdrop && (
              <div className={styles.heroBanner}>
                <div className="relative h-full w-full">
                  <Image
                    src={heroBackdrop}
                    alt=""
                    fill
                    loading="eager"
                    fetchPriority="high"
                    onError={() => setFailedBanner(bannerSrc)}
                    className={`${styles.heroBannerImage} ${heroBackdropIsCover ? styles.heroBannerFallback : ""}`}
                    sizes="100vw"
                  />
                </div>
                <div className={styles.heroVeil} />
              </div>
            )}

            {/* Soft aurora glows — decorative only */}
            <span className={`${styles.heroAura} ${styles.heroAuraCyan}`} aria-hidden="true" />
            <span className={`${styles.heroAura} ${styles.heroAuraMagenta}`} aria-hidden="true" />
            <span className={`${styles.heroAura} ${styles.heroAuraAmber}`} aria-hidden="true" />

            {/* Character art — right side */}
            {heroCharImage && (
              <div className={styles.heroArt} aria-hidden="true">
                <div className={styles.heroArtFrame}>
                  <Image
                    src={heroCharImage}
                    alt={heroCharName || ""}
                    fill
                    className={styles.heroArtImage}
                    sizes="50vw"
                  />
                </div>
              </div>
            )}

            {/* Content */}
            <div className={styles.heroContent}>
              <div className={styles.heroLayout}>
                {/* Cover */}
                <div className={styles.cover}>
                  <div className={styles.coverFrame}>
                    <Image
                      src={
                        anime.coverImage?.large ||
                        anime.coverImage?.extraLarge ||
                        ""
                      }
                      alt={title}
                      fill
                      className={styles.coverImage}
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    {anime.averageScore ? (
                      <div className={`${styles.scoreBadge} absolute -right-3 -top-3 flex h-12 w-12 items-center justify-center text-sm font-bold text-black`}>
                        {formatScore(anime.averageScore)}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Info */}
                <div className={styles.heroInfo}>
                  {anime.status === "RELEASING" && (
                    <span className={styles.statusPill}>
                      <span className={styles.statusDot} aria-hidden="true" /> On Air
                    </span>
                  )}
                  <h1 className={styles.heroTitle}>
                    {heroTitle}
                  </h1>
                  {heroSubtitle && (
                    <p className={styles.heroNative}>
                      {heroSubtitle}
                    </p>
                  )}

                  <div className={styles.metaRow}>
                    {anime.episodes ? (
                      <span className={styles.metaPrimary}>
                        {anime.episodes} Episodes
                      </span>
                    ) : null}
                    {anime.seasonYear ? (
                      <span>
                        {anime.season || ""} {anime.seasonYear}
                      </span>
                    ) : null}
                    {anime.studios?.nodes?.[0] && (
                      <Link
                        href={`/studio/${anime.studios.nodes[0].id}`}
                        className={styles.metaLink}
                      >
                        {anime.studios.nodes[0].name}
                      </Link>
                    )}
                    {anime.format && (
                      <span className={styles.metaBadge}>
                        {anime.format}
                      </span>
                    )}
                    {anime.source && (
                      <span className={styles.metaSource}>
                        {anime.source.replace(/_/g, " ")}
                      </span>
                    )}
                    {anime.duration ? <span>{anime.duration}m</span> : null}
                  </div>

                  {/* Genres */}
                  <div className={styles.genreRow}>
                    {anime.genres?.map((g) => (
                      <Link
                        key={g}
                        href={`/search?genre=${g}`}
                        className={styles.genreChip}
                      >
                        {g}
                      </Link>
                    ))}
                  </div>

                  {/* Dub Availability */}
                  {dubLangs && dubLangs.length > 0 && (
                    <div className={styles.dubRow}>
                      <span className={styles.dubLabel}>
                        Dubs Available
                      </span>
                      {dubLangs.map((lang) => {
                        const s = DUB_LANG_STYLES[lang] || {
                          bg: "#88888822",
                          text: "#888888",
                          border: "#88888844",
                        };
                        return (
                          <span
                            key={lang}
                            className={styles.dubChip}
                            style={{
                              backgroundColor: s.bg,
                              color: s.text,
                              border: `1px solid ${s.border}`,
                            }}
                          >
                            {lang}
                          </span>
                        );
                      })}
                      {dubLangs.length === 0 && (
                        <span className={styles.dubEmpty}>
                          No dub data found
                        </span>
                      )}
                      {dubLangs
                        .filter((l) => l !== "English")
                        .map((lang) => (
                          <span className={styles.dubNotifySlot} key={lang}>
                            <DubNotifyButton
                              malId={anime.id}
                              language={lang.toLowerCase()}
                              animeTitle={bestTitle(anime.title)}
                            />
                          </span>
                        ))}
                    </div>
                  )}

                  {/* CTA */}
                  <div className={styles.heroActions}>
                    <div className={styles.primaryActions}>
                      <button
                        onClick={() => toggle(anime)}
                        className={`${styles.primaryCta} ${saved ? styles.primaryCtaSaved : ""}`}
                      >
                        {saved ? "✓ Saved to List" : "+ Add to List"}
                      </button>
                      <span className={styles.followSlot}>
                        <AnimeFollowButton mediaId={anime.id} animeTitle={title} />
                      </span>
                      {anime.trailer?.site === "youtube" && (
                        <button
                          onClick={() => setTrailerOpen(true)}
                          className={styles.ghostCta}
                        >
                          ▶ Trailer
                        </button>
                      )}
                    </div>
                    <div className={styles.secondaryActions}>
                      <span className={styles.shareSlot}>
                        <ShareButton mediaId={anime.id} title={title} copyOnly />
                      </span>
                      <button
                        onClick={() => setMomentMakerOpen(true)}
                        className={`${styles.ghostCta} ${styles.accentCta}`}
                      >
                        ✦ Create Moment
                      </button>
                      <Link
                        href={`/search?sort=TRENDING_DESC`}
                        className={`${styles.ghostCta} ${styles.mutedCta}`}
                      >
                        Discover More →
                      </Link>
                    </div>
                  </div>
                </div>

                {anime.nextAiringEpisode && (
                  <aside className={styles.heroNextDock}>
                    <div className={styles.airingStrip}>
                      <span className={styles.countdownSlot}>
                        <CountdownChip target={anime.nextAiringEpisode} />
                      </span>
                      <span className={styles.alertSlot}>
                        <AiringAlertButton
                          mediaId={anime.id}
                          nextAiringEpisode={anime.nextAiringEpisode}
                        />
                      </span>
                    </div>
                    <CalendarSync
                      internalOnly
                      animeId={anime.id}
                      title={title}
                      nextEpisode={{
                        episode: anime.nextAiringEpisode.episode,
                        airDate: new Date(
                          anime.nextAiringEpisode.airingAt * 1000,
                        ).toISOString(),
                        timeUntil: anime.nextAiringEpisode.timeUntilAiring
                          ? `${Math.floor(anime.nextAiringEpisode.timeUntilAiring / 86400)}d ${Math.floor((anime.nextAiringEpisode.timeUntilAiring % 86400) / 3600)}h`
                          : undefined,
                      }}
                      className={styles.calendarCard}
                    />
                  </aside>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Stats Bar ── */}
          <div className={styles.quickStats}>
            <div className={`${styles.quickStatsInner} mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 text-sm sm:px-6`}>
              {rankings.slice(0, 3).map((r) => (
                <span
                  key={r.id}
                  className="font-mono text-xs text-[var(--color-mute)]"
                >
                  <span className="text-[var(--color-magenta)]">#{r.rank}</span>{" "}
                  {r.context}
                  {r.year ? ` (${r.year})` : ""}
                </span>
              ))}
              {anime.favourites ? (
                <span className="font-mono text-xs text-[var(--color-mute)]">
                  ♥ {anime.favourites.toLocaleString()} favorites
                </span>
              ) : null}
              {anime.popularity ? (
                <span className="font-mono text-xs text-[var(--color-mute)]">
                  ◎ {anime.popularity.toLocaleString()} popularity
                </span>
              ) : null}
              {anime.meanScore ? (
                <span className="font-mono text-xs text-[var(--color-cyan)]">
                  ◎ Mean: {formatScore(anime.meanScore)}
                </span>
              ) : null}
            </div>
          </div>

          {/* ── Main Layout ── */}
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
            {/* ── Left Column ── */}
            <div className="space-y-12 min-w-0">
              {/* Synopsis */}
              <section className={styles.synopsisSection}>
                <SectionTitle>Synopsis</SectionTitle>
                <div className={styles.synopsisPanel}>
                  <p className={styles.synopsisText}>
                    {stripHtml(anime.description) || "No description available."}
                  </p>
                  {anime.tags && anime.tags.length > 0 && (
                    <div className={styles.synopsisTags}>
                      {anime.tags
                        .filter((t) => t.rank >= 60 && !t.isMediaSpoiler)
                        .slice(0, 10)
                        .map((t) => (
                          <span key={t.id} className={styles.synopsisTag}>
                            {t.name}
                            {t.isAdult && (
                              <span className={styles.tagAdultDot} aria-hidden="true">
                                ●
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className={styles.communityBlock}>
                  <h3 className={styles.communityHead}>
                    <span className={styles.communityMark} aria-hidden="true" />
                    Community Tags
                  </h3>
                  <CommunityTagPanel mediaId={anime.id} />
                </div>
              </section>

              {/* In-content Ad Banner for Anime detail */}
              <div className={`${styles.adSlot} my-6 flex justify-center`} aria-label="Sponsored slot">
                <AdBanner placement="anime-detail-inline" type="sidebar" />
              </div>

              {/* ZyniVerse Editorial */}
              {editorial && (
                <section className={`${styles.editorialCard} relative overflow-hidden rounded-2xl p-5 sm:p-6`}>
                  <div className={`${styles.editorialGlow} pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl`} aria-hidden="true" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-magenta)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-magenta)]">
                        ✦ ZyniVerse Editorial
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                        <span className="text-[var(--color-magenta)]">
                          {editorial.rating.toFixed(1)}
                        </span>
                        <span className="text-[var(--color-mute)]">/ 5</span>
                        <span className="ml-1 rounded-full bg-[var(--color-void)] px-2 py-0.5 text-[10px] text-[var(--color-mute)] border border-[var(--color-line)]">
                          {editorial.ratingLabel}
                        </span>
                      </span>
                    </div>
                    <p className="mt-4 leading-relaxed text-[15px] text-[var(--color-mute)]">
                      {editorial.verdict}
                    </p>
                    {editorial.highlights.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {editorial.highlights.map((h, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-[var(--color-mute)]"
                          >
                            <span className="mt-0.5 text-[var(--color-magenta)]">
                              ✦
                            </span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {editorial.dubStatus &&
                      Object.values(editorial.dubStatus).some(Boolean) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {Object.entries(editorial.dubStatus)
                            .filter(([, v]) => Boolean(v))
                            .map(([lang, status]) => {
                              const style = DUB_LANG_STYLES[
                                lang.charAt(0).toUpperCase() + lang.slice(1)
                              ] ||
                                DUB_LANG_STYLES[lang] || {
                                  bg: "#22d3ee22",
                                  text: "#22d3ee",
                                  border: "#22d3ee44",
                                };
                              return (
                                <span
                                  key={lang}
                                  className="rounded-full border px-2.5 py-1 text-[10px] font-medium"
                                  style={{
                                    background: style.bg,
                                    color: style.text,
                                    borderColor: style.border,
                                  }}
                                >
                                  {lang.charAt(0).toUpperCase() + lang.slice(1)}{" "}
                                  · {status}
                                </span>
                              );
                            })}
                        </div>
                      )}
                    {editorial.indianNote && (
                      <p className="mt-4 rounded-xl bg-[var(--color-void)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-mute)]">
                        🇮🇳{" "}
                        <span className="font-bold text-[var(--color-cyan)]">
                          For Indian viewers:
                        </span>{" "}
                        {editorial.indianNote}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Zyni AI Lab */}
              <AiLab animeId={anime.id} title={title} />

              {/* India Dub Cast */}
              <IndianDubCast mediaId={anime.id} />

              {/* Characters */}
              {chars.length > 0 && (
                <section className={styles.castSection}>
                  <SectionTitle>Characters & Voice Actors</SectionTitle>
                  <StaggerGrid className={styles.castGrid}>
                    {chars.slice(0, 25).map((edge, i) => {
                      const char = edge.node;
                      const charName = char.name?.full || "Character";
                      const jpVA = edge.voiceActors?.[0];
                      const enVA = edge.voiceActorRoles?.find((r) =>
                        r.dubGroup?.toLowerCase().includes("english"),
                      )?.voiceActor;
                      const isMain = edge.role?.toLowerCase().includes("main");
                      const renderVa = (va: typeof jpVA, lang: string) => {
                        if (!va) return null;
                        const vaName = va.name?.full || "Voice Actor";
                        return (
                          <span className={styles.castVa}>
                            <span className={styles.castVaAvatar}>
                              {va.image?.medium ? (
                                <Image
                                  src={va.image.medium}
                                  alt={vaName}
                                  fill
                                  className="object-cover"
                                  sizes="22px"
                                />
                              ) : (
                                <span className={styles.castVaFallback} aria-hidden>
                                  {initialOf(vaName)}
                                </span>
                              )}
                            </span>
                            <span className={styles.castVaText}>
                              <span className={styles.castVaName} title={vaName}>
                                {vaName}
                              </span>
                              <span className={styles.castVaLang}>{lang}</span>
                            </span>
                          </span>
                        );
                      };

                      return (
                        <StaggerItem key={char.id}>
                          <div
                            className={styles.castCard}
                            style={
                              {
                                "--cast-accent": isMain ? "#fbbf24" : "#22d3ee",
                                "--cast-index": i,
                              } as React.CSSProperties
                            }
                          >
                            <span className={styles.castIndex}>
                              #{String(i + 1).padStart(2, "0")}
                            </span>
                            <Link href={`/character/${char.id}`} className={styles.castMain}>
                              <span className={styles.castAvatar}>
                                {char.image?.medium ? (
                                  <Image
                                    src={char.image.medium}
                                    alt={charName}
                                    fill
                                    className="object-cover"
                                    sizes="52px"
                                  />
                                ) : (
                                  <span className={styles.castFallback} aria-hidden>
                                    {initialOf(charName)}
                                  </span>
                                )}
                              </span>
                              <span className={styles.castInfo}>
                                <span className={styles.castName} title={charName}>
                                  {charName}
                                </span>
                                <span className={styles.castRole} title={edge.role || ""}>
                                  {edge.role}
                                </span>
                              </span>
                            </Link>
                            <div className={styles.castFoot}>
                              <span className={styles.castVote}>
                                <CharacterVoteWidget
                                  characterId={char.id}
                                  mediaId={anime.id}
                                />
                              </span>
                              {renderVa(jpVA, "Japanese")}
                              {renderVa(enVA, "English")}
                            </div>
                          </div>
                        </StaggerItem>
                      );
                    })}
                  </StaggerGrid>
                  {chars.length > 25 && (
                    <p className={styles.castMore}>
                      +{chars.length - 25} more characters
                    </p>
                  )}
                </section>
              )}

              {/* Staff */}
              {staffEdges.length > 0 && (
                <section className={styles.staffSection}>
                  <div className={styles.staffHead}>
                    <SectionTitle>Staff</SectionTitle>
                    {staffEdges.length > 12 && (
                      <button
                        type="button"
                        aria-expanded={showAllStaff}
                        onClick={() => setShowAllStaff((o) => !o)}
                        className={styles.staffToggle}
                      >
                        {showAllStaff
                          ? "Show less"
                          : `View all (${staffEdges.length})`}
                        <span aria-hidden className={styles.staffToggleArrow}>
                          {showAllStaff ? "↺" : "→"}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className={styles.staffGrid}>
                    {(showAllStaff ? staffEdges : staffEdges.slice(0, 12)).map(
                      (s, i) => {
                        const staffName = s.node.name?.full || "Staff";
                        return (
                          <Link
                            key={`${s.node.id}-${i}`}
                            href={`/staff/${s.node.id}`}
                            className={styles.staffCard}
                            style={
                              {
                                "--staff-accent": STAFF_ACCENTS[i % STAFF_ACCENTS.length],
                                "--staff-index": i,
                              } as React.CSSProperties
                            }
                          >
                            <span className={styles.staffIndex}>
                              #{String(i + 1).padStart(2, "0")}
                            </span>
                            <span className={styles.staffAvatar}>
                              {s.node.image?.medium ? (
                                <Image
                                  src={s.node.image.medium}
                                  alt={staffName}
                                  fill
                                  className="object-cover"
                                  sizes="44px"
                                />
                              ) : (
                                <span className={styles.staffFallback} aria-hidden>
                                  {staffName.trim().charAt(0).toUpperCase()}
                                </span>
                              )}
                            </span>
                            <span className={styles.staffInfo}>
                              <span className={styles.staffName} title={staffName}>
                                {staffName}
                              </span>
                              <span className={styles.staffRole} title={s.role || ""}>
                                {s.role}
                              </span>
                            </span>
                            <span aria-hidden className={styles.staffArrow}>↗</span>
                          </Link>
                        );
                      },
                    )}
                  </div>
                </section>
              )}

              {/* Relations */}
              {relations.length > 0 && (
                <HorizontalScroll
                  title="Related"
                  items={relations.map((r) => ({
                    id: r.node.id,
                    type: r.node.type,
                    coverImage: r.node.coverImage,
                    title: r.node.title,
                    averageScore: r.node.averageScore,
                    episodes: r.node.type === "ANIME" ? r.node.episodes : null,
                    chapters: r.node.type === "MANGA" ? r.node.chapters : null,
                  }))}
                />
              )}

              {/* Recommendations */}
              {recommendedItems.length > 0 && (
                <HorizontalScroll
                  title="You May Also Like"
                  items={recommendedItems.map((m) => ({
                    id: m.id,
                    type: m.type,
                    coverImage: m.coverImage,
                    title: m.title,
                    averageScore: m.averageScore,
                    episodes: m.episodes,
                    chapters: m.chapters,
                  }))}
                />
              )}

              {/* Reviews */}
              <ReviewsSection mediaId={anime.id} />

              {/* Long-form Reviews */}
              <LongReviews
                mediaId={anime.id}
                mediaTitle={title}
                mediaImage={anime.coverImage?.large || ""}
              />
            </div>

            {/* ── Right Column (Sidebar) ── */}
            <aside className="space-y-6">
              {/* Ad — compact, labelled, and easy to ignore */}
              <div className={styles.sidebarAd} aria-label="Sponsored slot">
                <AdBanner placement="anime-detail" type="sidebar" />
              </div>

              {/* Episode Tracker */}
              {anime.episodes && (
                <EpisodeTracker
                  mediaId={anime.id}
                  totalEpisodes={anime.episodes}
                  animeTitle={title}
                />
              )}

              {/* Your Rating */}
              <AnimeRatingInput mediaId={anime.id} />

              {/* Episode Ratings from MAL */}
              {anime.idMal && <EpisodeRatingsCard malId={anime.idMal} internalOnly />}

              {/* Filler Guide */}
              <FillerGuide anilistId={anime.id} animeTitle={title} internalOnly />

              {/* Episode Discussions */}
              <EpisodeDiscussion mediaId={anime.id} className={boxStyles.box} />

              {/* Theme Songs */}
              <ThemeSongsSection mediaId={anime.id} internalOnly />

              {/* Detailed Metadata */}
              <div className={boxStyles.box}>
                <h3 className={`${boxStyles.boxTitle} ${boxStyles.sideHeading} mb-3`}>Details</h3>
                <MetadataPanel mediaId={anime.id} internalOnly />
              </div>

              {/* Recommendation Relationships */}
              <RecRelationships mediaId={anime.id} />

              {/* Fan Recommendations */}
              <FanRecommendations mediaId={anime.id} mediaTitle={title} className={boxStyles.box} />

              {/* Users Also Liked */}
              <UsersAlsoLiked mediaId={anime.id} />

              {/* Forum Discussion */}
              <ForumDiscussionWidget
                animeId={anime.id}
                animeTitle={title}
                animeImage={anime.coverImage?.large || ""}
                className={boxStyles.box}
              />

              {/* Where to Watch */}
              <WhereToWatch
                streamingLinks={streamingLinks.map((l) => ({
                  site: l.site,
                  url: l.url,
                }))}
                title={title}
                internalOnly
                className={boxStyles.box}
              />

              {/* Sponsored merch shortcut — compact, labelled, and easy to ignore. */}
              <div className="flex justify-center">
                <PlayAsiaPill
                  query={title}
                  label="Anime merch on Play-Asia"
                  className={boxStyles.sponsorPill}
                />
              </div>

              {/* India watch guide — the long-form /watch/{id} page. This is the
                  only internal link to that route; without it every watch guide
                  was an orphan that Google could only find via the sitemap. */}
              <Link
                href={`/watch/${anime.id}`}
                className={`${boxStyles.box} ${styles.internalLinkCard} block transition-colors`}
              >
                <h3 className={`${boxStyles.boxTitle} font-display text-sm font-bold`}>
                  Full India Watch Guide
                </h3>
                <p className={`${boxStyles.mutedText} mt-1`}>
                  Every legal streaming platform for {title} in India, with dub
                  languages and pricing.
                </p>
                <span className={`${boxStyles.textLink} mt-3 inline-block text-xs`}>
                  Open guide →
                </span>
              </Link>

              {/* Hindi/Tamil/Telugu dub guide, when one is tracked. */}
              {dubGuideHref && (
                <Link
                  href={dubGuideHref}
                  className={`${boxStyles.box} ${styles.internalLinkCard} block transition-colors`}
                >
                  <h3 className={`${boxStyles.boxTitle} font-display text-sm font-bold`}>
                    Hindi Dub Guide
                  </h3>
                  <p className={`${boxStyles.mutedText} mt-1`}>
                    Episodes, release schedule and where to watch {title} in
                    Hindi, Tamil or Telugu.
                  </p>
                  <span className={`${boxStyles.textLink} mt-3 inline-block text-xs`}>
                    Open dub guide →
                  </span>
                </Link>
              )}

              {/* TV Channel Availability */}
              <TvScheduleCard title={title} />

              {/* Internal discovery — no exit links from this page */}
              <div className={`${boxStyles.box} ${styles.sidebarCard}`}>
                <h3 className={`${boxStyles.boxTitle} ${boxStyles.sideHeading} mb-3`}>
                  Explore on ZyniVerse
                </h3>
                <div className="space-y-2">
                  <Link
                    href={`/anime/${anime.id}/filler`}
                    className={`${boxStyles.miniLink} ${styles.internalMiniLink}`}
                  >
                    <span aria-hidden="true">✦</span>
                    Filler guide
                  </Link>
                  <Link
                    href="/watch-order"
                    className={`${boxStyles.miniLink} ${styles.internalMiniLink}`}
                  >
                    <span aria-hidden="true">◎</span>
                    Watch order library
                  </Link>
                  <Link
                    href={`/search?genre=${encodeURIComponent(anime.genres?.[0] || "Action")}`}
                    className={`${boxStyles.miniLink} ${styles.internalMiniLink}`}
                  >
                    <span aria-hidden="true">✧</span>
                    More like this
                  </Link>
                </div>
              </div>

              {/* Rankings */}
              {rankings.length > 0 && (
                <div className={boxStyles.box}>
                  <h3 className={`${boxStyles.boxTitle} ${boxStyles.sideHeading} mb-3`}>
                    Rankings
                  </h3>
                  <div className="space-y-2">
                    {rankings.slice(0, 4).map((r) => (
                      <div key={r.id} className={boxStyles.rankRow}>
                        <div className="flex items-center gap-2">
                          <span className={boxStyles.rankChip}>
                            #{r.rank}
                          </span>
                          <span className={boxStyles.rankContext}>
                            {r.context}
                          </span>
                        </div>
                        {r.year && (
                          <span className={boxStyles.tinyMuted}>
                            {r.year}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Distribution */}
              <ScoreDistributionChart scoreDistribution={scoreDist} className={boxStyles.box} />

              {anime.favourites ? (
                <div className={`${boxStyles.box} text-center`}>
                  <div className={boxStyles.favoriteNumber}>
                    {anime.favourites.toLocaleString()}
                  </div>
                  <div className={`${boxStyles.mutedText} mt-0.5`}>
                    Favorites
                  </div>
                </div>
              ) : null}

              <div className={`${boxStyles.box} ${boxStyles.idNote}`}>
                <span className={boxStyles.eyebrow}>Reference IDs</span>
                <span className={`${boxStyles.monoText} text-xs`}>
                  AniList #{anime.id}
                  {anime.idMal ? ` · MAL #${anime.idMal}` : ""}
                </span>
              </div>
            </aside>
          </div>

          {/* ── Reels from this anime ── */}
          {reels.length > 0 && (
            <section className={`${styles.reelsSection} mx-auto mt-14 max-w-7xl px-4 sm:px-6`}>
              <FadeIn>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                    Reels from this anime
                  </h2>
                  <span className="flex h-6 items-center rounded-full bg-[var(--color-magenta)]/15 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-magenta)]">
                    {reels.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-mute)]">
                  Short anime clips uploaded by the community on ZyniVerse.
                </p>
              </FadeIn>
              <StaggerGrid className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {reels.map((r) => (
                  <StaggerItem key={r.id}>
                    <Link
                      href={`/reels/${r.id}`}
                      className={`${styles.reelCard} group relative block aspect-[9/16] overflow-hidden rounded-xl transition`}
                    >
                      {r.thumbnailUrl ? (
                        <Image
                          src={r.thumbnailUrl}
                          alt={r.caption || `Reel by @${r.username}`}
                          fill
                          sizes="(max-width: 768px) 45vw, 15vw"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-pink-600/40 via-[var(--color-panel)] to-purple-600/40">
                          <span className="text-3xl text-white/90">▶</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2.5">
                        <p className="line-clamp-1 text-[11px] font-bold text-white">
                          @{r.username}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-white/70">
                          <span>▶ {r.views.toLocaleString()}</span>
                          <span>❤️ {r.likesCount}</span>
                        </div>
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </section>
          )}

          {/* ── Moment Maker ── */}
          <MomentMaker
            isOpen={momentMakerOpen}
            onClose={() => setMomentMakerOpen(false)}
            animeId={anime.id}
            animeTitle={title}
            animeCover={anime.coverImage?.extraLarge || anime.coverImage?.large}
            copyOnly
          />

          {/* ── Trailer Modal ── */}
          {(() => {
            const tid = anime?.trailer?.id;
            if (!trailerOpen || !tid) return null;
            const embedUrl = `https://www.youtube-nocookie.com/embed/${tid}?autoplay=1&rel=0&playsinline=1`;
            return (
              <div
                className={`${styles.modalBackdrop} fixed inset-0 z-50 flex items-center justify-center p-4`}
                onClick={() => setTrailerOpen(false)}
              >
                <div
                  className={`${styles.modalPanel} relative w-full max-w-4xl`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <iframe
                    src={embedUrl}
                    className={`${styles.modalFrame} aspect-video w-full rounded-xl`}
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                  />
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      onClick={() => setTrailerOpen(false)}
                      className={`${styles.modalClose} rounded-full px-3 py-1 text-sm transition-all`}
                    >
                      Close ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bottom Leaderboard Banner */}
          <div className={`${styles.adSlot} my-8 flex justify-center`} aria-label="Sponsored slot">
            <AdBanner placement="anime-bottom" type="banner" />
          </div>
        </div>
      </ErrorBoundary>
    </PageTransition>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={`${styles.sectionTitle} mb-4 flex items-center gap-2`}>
      <span className={`${styles.sectionMark} h-4 w-1 rounded-full`} aria-hidden="true" />
      <RevealTitle as="span">{children}</RevealTitle>
    </h2>
  );
}
