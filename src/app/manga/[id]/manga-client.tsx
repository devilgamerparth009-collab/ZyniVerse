"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { bestTitle } from "@/lib/anilist";
import { inferMangaType } from "@/lib/manga";
import RevealTitle from "@/components/RevealTitle";
import StoryReveal from "@/components/StoryReveal";
import RankingsReveal from "@/components/RankingsReveal";
import CharactersReveal from "@/components/CharactersReveal";
import StaffReveal from "@/components/StaffReveal";
import RelatedReveal from "@/components/RelatedReveal";
import RecommendationsReveal from "@/components/RecommendationsReveal";
import WhyRecsReveal from "@/components/WhyRecsReveal";
import SidebarReveal from "@/components/SidebarReveal";
import { DynamicCarousel3D as Carousel3D } from "@/components/lazy";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import MangaProgress from "@/components/MangaProgress";
import MangaRatingInput from "@/components/MangaRatingInput";
import MangaReadingHistory from "@/components/MangaReadingHistory";
import MangaStatsCard from "@/components/MangaStatsCard";
import ScoreDistributionChart from "@/components/features/ScoreDistributionChart";
import RecRelationships from "@/components/RecRelationships";
import DiscussionLinks from "@/components/DiscussionLinks";
import UsersAlsoLiked from "@/components/features/UsersAlsoLiked";
import ShareButton from "@/components/ShareButton";
import AdBanner from "@/components/AdBanner";
import NativeBannerAd from "@/components/NativeBannerAd";
import AffiliateLink from "@/components/AffiliateLink";
import PlayAsiaPill from "@/components/PlayAsiaPill";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/manga";
import type { MediaMangaFull } from "@/lib/anilist";
import { logError } from "@/lib/logger";

function stripHtml(str: string | null | undefined = "") { return str ? str.replace(/<[^>]*>/g, "") : ""; }
function splitStorySource(text: string) {
  const match = text.match(/(\(Source:[^)\n]*\))(?:\s*)$/);
  if (!match || match.index == null) return { body: text, separator: "", source: "" };
  const source = match[1] ?? "";
  const body = text.slice(0, match.index).replace(/\s+$/, "");
  const separator = text.slice(body.length, match.index);
  return { body, separator, source };
}
function formatScore(score?: number | null) { return score ? (score / 10).toFixed(1) : "—"; }
function formatCount(value?: number | null) { return value && value > 0 ? value.toLocaleString("en-US") : "—"; }
function formatMangaDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null) {
  if (!d?.year) return "Unknown";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = d.month && d.month >= 1 && d.month <= 12 ? months[d.month - 1] : "";
  return [month, d.day || "", d.year].filter(Boolean).join(" ");
}
function linkHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function siteInitial(site: string) {
  return site.trim().charAt(0).toUpperCase() || "↗";
}

interface MangaEntryDB {
  id: string;
  mediaId: number;
  title: string;
  coverImage: string | null;
  status: string;
  chapters: number;
  volumes: number;
  totalChapters: number | null;
  totalVolumes: number | null;
  score: number | null;
  mangaDexId: string | null;
}

interface MangaChapterDB {
  id: string;
  chapter: number;
  title: string | null;
  read: boolean;
  readAt: string | null;
}

const STATUS_OPTIONS = ["READING", "COMPLETED", "PLANNING", "DROPPED", "PAUSED", "REREADING"];
const STATUS_DIST_LABELS: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Releasing",
  NOT_YET_RELEASED: "Not yet released",
  CANCELLED: "Cancelled",
  HIATUS: "On hiatus",
};

export default function MangaDetailsPage({ initialManga }: { initialManga: MediaMangaFull }) {
  const { id } = useParams<{ id: string }>();
  const manga = initialManga;
  const [actionMsg, setActionMsg] = useState("");
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [entry, setEntry] = useState<MangaEntryDB | null>(null);
  const [chapters, setChapters] = useState<MangaChapterDB[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("PLANNING");
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [readingDex, setReadingDex] = useState(false);
  const router = useRouter();

  function notify(message: string) {
    setActionMsg(message);
    setTimeout(() => setActionMsg(""), 2800);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  async function openReader() {
    if (readingDex) return;
    setReadingDex(true);
    try {
      let dexId = entry?.mangaDexId || null;
      if (!dexId) {
        const res = await fetch("/api/manga/dex/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: Number(id), title }),
        });
        const data = await res.json();
        if (!res.ok || !data.mangaDexId) {
          notify(data.error || "Could not find this manga on MangaDex.");
          return;
        }
        dexId = data.mangaDexId;
      }
      router.push(`/manga/read/${dexId}?mediaId=${id}&title=${encodeURIComponent(title)}`);
    } catch (e) {
      logError(e);
      notify("Failed to open reader. Try again.");
    } finally {
      setReadingDex(false);
    }
  }

  async function fetchEntry() {
    try {
      const res = await fetch(`/api/manga/list/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntry(data.entry);
    } catch (e) { logError(e); }
  }

  const fetchChapters = useCallback(async () => {
    try {
      const res = await fetch(`/api/manga/chapters?mediaId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setChapters(data.chapters || []);
      setShowChapters(true);
    } catch (e) { logError(e); }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/manga/list/${id}`)
      .then((r) => (r.ok ? r.json() : { entry: null }))
      .catch(() => ({ entry: null }))
      .then((d) => {
        if (!cancelled) {
          setEntry(d.entry || null);
          if (d.entry) {
            setShowChapters(true);
            fetchChapters();
          }
        }
      });
    return () => { cancelled = true; };
  }, [id, fetchChapters]);

  async function addToList(status: string) {
    if (!manga) return;
    try {
      const res = await fetch("/api/manga/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: manga.id,
          title: bestTitle(manga.title),
          coverImage: manga.coverImage?.extraLarge || manga.coverImage?.large,
          status,
          subType: inferMangaType(manga),
          totalChapters: manga.chapters,
          totalVolumes: manga.volumes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data.entry);
        fetchChapters();
        notify(`Added to ${STATUS_LABELS[status] || status}.`);
      } else if (res.status === 401) {
        notify("Sign in to add this manga to your list.");
      } else {
        notify("Couldn't add this manga — try again.");
      }
    } catch (e) {
      logError(e);
      notify("Couldn't add this manga — try again.");
    }
  }

  async function removeFromList() {
    try {
      const res = await fetch("/api/manga/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: Number(id) }),
      });
      if (res.ok) {
        setEntry(null);
        setChapters([]);
        setShowChapters(false);
        notify("Removed from your list.");
      } else {
        notify("Couldn't remove — try again.");
      }
    } catch (e) {
      logError(e);
      notify("Couldn't remove — try again.");
    }
  }

  async function handleStatusChange(status: string) {
    try {
      const res = await fetch(`/api/manga/list/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data.entry);
        notify(`Moved to ${STATUS_LABELS[status] || status}.`);
      } else {
        notify("Couldn't update status — try again.");
      }
    } catch (e) {
      logError(e);
      notify("Couldn't update status — try again.");
    }
  }

  async function markChapter(chapter: number, read: boolean) {
    try {
      const res = await fetch("/api/manga/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: Number(id), chapter, read }),
      });
      if (res.ok) {
        fetchChapters();
        fetchEntry();
      }
    } catch (e) {
      logError(e);
      notify("Couldn't update that chapter — try again.");
    }
  }

  function handleProgressUpdate(chapters: number, volumes: number) {
    setEntry((prev) => prev ? { ...prev, chapters, volumes } : prev);
  }

  function handleScoreUpdate(score: number | null) {
    setEntry((prev) => prev ? { ...prev, score } : prev);
  }

  const title = bestTitle(manga.title);
  const story = splitStorySource(stripHtml(manga.description) || "No description available.");
  const chars = manga.characters?.edges || [];
  const staffEdges = manga.staff?.edges || [];
  const allLinks = (manga.externalLinks || []).filter((l) => !l.isDisabled && l.url);
  const links = Array.from(new Map(allLinks.map((l) => [l.url, l])).values());
  const allRelations = manga.relations?.edges || [];
  const relations = allRelations.filter((e) => Boolean(e.node?.id && e.node?.title));
  const relationCounts = relations.reduce<Record<string, number>>((acc, e) => {
    acc[e.relationType] = (acc[e.relationType] || 0) + 1;
    return acc;
  }, {});
  const recs = manga.recommendations?.edges || [];
  const rankings = manga.rankings || [];
  const scoreDist = manga.stats?.scoreDistribution || [];
  const statusDist = manga.stats?.statusDistribution || [];
  const published = formatMangaDate(manga.startDate);
  const ended = manga.endDate?.year ? formatMangaDate(manga.endDate) : manga.status === "RELEASING" ? "Present" : "—";

  const readChapters = chapters.filter((c) => c.read);
  const readCount = readChapters.length;
  const totalChapterCount = manga.chapters || entry?.totalChapters || chapters.length;
  const readProgress = totalChapterCount > 0 ? Math.round((readCount / totalChapterCount) * 100) : 0;

  return (
    <PageTransition><ErrorBoundary label="MangaDetails"><div>
      {/* Hero */}
      <div className="mdt-hero relative overflow-hidden border-b border-[var(--color-line)]">
        {manga.bannerImage && (
          <div className="mdt-banner absolute inset-0" aria-hidden>
            <div className="relative h-full w-full">
              <Image src={manga.bannerImage} alt="" fill className="mdt-banner-img object-cover opacity-20" sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-void)] via-[var(--color-void)]/80 to-[var(--color-void)]/30" />
          </div>
        )}
        <span className="mdt-hero-scan" aria-hidden />

        <div className="relative mx-auto flex max-w-6xl flex-col gap-7 px-4 py-10 sm:flex-row sm:px-6 sm:py-14">
          <div className="mdt-cover relative h-64 w-44 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)] shadow-2xl sm:h-80 sm:w-56">
            <Image
              src={manga.coverImage?.extraLarge || manga.coverImage?.large || ""}
              alt={title}
              fill
              className="mdt-cover-img object-cover"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            <span className="mdt-cover-frame" aria-hidden />
            {manga.averageScore ? (
              <div className="mdt-score-badge absolute -right-2 -top-2 flex flex-col items-center justify-center rounded-full bg-[var(--color-violet)] text-sm font-bold text-black shadow-lg">
                {formatScore(manga.averageScore)}
                <span className="mdt-score-label">SCORE</span>
              </div>
            ) : null}
          </div>

          <div className="mdt-hero-copy min-w-0 flex-1">
            <div className="mdt-badge-row mb-3 flex flex-wrap gap-2">
              {manga.status === "RELEASING" && (
                <span className="mdt-live-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  <span className="mdt-pulse-dot h-1.5 w-1.5 rounded-full" /> Publishing
                </span>
              )}
              {manga.isLicensed && <span className="mdt-licensed rounded-full px-2.5 py-1 text-[11px] font-semibold">✓ Licensed</span>}
              <span className="mdt-format-badge rounded-full px-2.5 py-1 text-[11px] font-semibold">{manga.format || "Manga"}</span>
              <span className="mdt-origin-badge rounded-full px-2.5 py-1 text-[11px]">
                {manga.source?.replace(/_/g, " ") || "Original"} · {manga.countryOfOrigin || "JP"}
              </span>
            </div>

            <div className="mdt-title-frame neon-rgb-border relative overflow-hidden rounded-xl px-4 py-2">
              <h1 className="mdt-title font-display text-3xl font-bold leading-tight sm:text-5xl">
                {title}
                <span className="mdt-title-sheen" aria-hidden />
              </h1>
            </div>
            {manga.title.native && <p className="mdt-native mt-1 text-[var(--color-mute)]">{manga.title.native}</p>}

            <div className="mdt-facts mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="mdt-fact"><span>Published</span><strong>{published}</strong></div>
              <div className="mdt-fact"><span>Series end</span><strong>{ended}</strong></div>
              <div className="mdt-fact"><span>Chapters</span><strong>{manga.chapters ? formatCount(manga.chapters) : "Ongoing"}</strong></div>
              <div className="mdt-fact"><span>Volumes</span><strong>{manga.volumes ? formatCount(manga.volumes) : "Ongoing"}</strong></div>
            </div>

            {/* Genres */}
            <div className="mdt-genres mt-4 flex flex-wrap gap-2">
              {manga.genres?.map((g) => (
                <Link key={g} href={`/search?genre=${g}&type=MANGA`}
                  className="mdt-genre rounded-full px-3 py-1 text-xs transition-colors"
                >{g}</Link>
              ))}
            </div>

            {/* Real quick stats — en-US number grouping, no locale surprises */}
            <div className="mdt-stats mt-4 flex flex-wrap gap-2">
              {rankings.slice(0, 2).map((r) => (
                <span key={r.id} className="mdt-stat font-mono text-xs">
                  <b>#{r.rank}</b> {r.context}{r.year ? ` (${r.year})` : ""}
                </span>
              ))}
              <span className="mdt-stat font-mono text-xs"><b>♥ {formatCount(manga.favourites)}</b> favorites</span>
              <span className="mdt-stat font-mono text-xs"><b>◎ {formatCount(manga.popularity)}</b> popularity</span>
              <span className="mdt-stat mdt-stat-mean font-mono text-xs"><b>★ {formatScore(manga.meanScore)}</b> mean score</span>
            </div>

            {/* CTA */}
            <div className="mdt-actions mt-5 flex flex-wrap items-center gap-2.5">
              {entry ? (
                <>
                  <span className="mdt-status-pill rounded-full px-3 py-1 text-xs font-semibold text-black"
                    style={{ backgroundColor: STATUS_COLORS[entry.status] || "var(--color-mute)" }}
                  >{STATUS_LABELS[entry.status] || entry.status}</span>
                  <select value={entry.status} onChange={(e) => handleStatusChange(e.target.value)}
                    className="mdt-select rounded-lg px-3 py-1.5 text-xs outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                  </select>
                  <button onClick={removeFromList}
                    className="mdt-btn mdt-btn-danger rounded-lg px-4 py-2 text-xs"
                  >Remove</button>
                </>
              ) : (
                <>
                  <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                    className="mdt-select rounded-lg px-3 py-1.5 text-xs outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                  </select>
                  <button onClick={() => addToList(selectedStatus)}
                    className="mdt-btn mdt-btn-primary rounded-full px-5 py-2 text-sm font-semibold text-black"
                  >Add to My List</button>
                </>
              )}
              <button
                onClick={openReader}
                disabled={readingDex}
                className="mdt-btn mdt-btn-read rounded-full px-5 py-2 text-sm font-semibold text-black"
              >
                {readingDex ? "Finding source…" : "📖 Read Online"}
              </button>
              <div className="mdt-share"><ShareButton mediaId={manga.id} title={title} /></div>
            </div>
            {actionMsg && (
              <p className="mdt-action-msg mt-2 text-xs" role="status" aria-live="polite">{actionMsg}</p>
            )}
            <div className="mdt-source-pills mt-3 flex flex-wrap gap-2">
              <a href={manga.siteUrl} target="_blank" rel="noopener noreferrer" className="mdt-source-pill">AniList ↗</a>
              {manga.idMal && (
                <a href={`https://myanimelist.net/manga/${manga.idMal}`} target="_blank" rel="noopener noreferrer" className="mdt-source-pill">MyAnimeList ↗</a>
              )}
              {entry?.mangaDexId && (
                <a href={`https://mangadex.org/title/${entry.mangaDexId}`} target="_blank" rel="noopener noreferrer" className="mdt-source-pill">MangaDex ↗</a>
              )}
              <span className="mdt-source-hint">Live metadata · AniList</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mdt-main mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="mdt-content space-y-12 min-w-0">
          {/* Story */}
          <StoryReveal>
            <section className="mdt-section mdt-story-section">
              <SectionTitle>Story</SectionTitle>
              <div className="mdt-story-panel">
                <div className="mdt-story-grid">
                  <div className="mdt-story-main">
                    <p className="mdt-story mdt-story-copy">
                      {story.body}{story.separator}
                      {story.source && <span className="mdt-story-source">{story.source}</span>}
                    </p>
                  </div>
                  {manga.tags && manga.tags.length > 0 && (
                    <div className="mdt-story-tags-wrap">
                      <div className="mdt-tag-list mdt-story-tags">
                        {manga.tags.filter((t) => t.rank >= 60 && !t.isMediaSpoiler).slice(0, 10).map((t) => (
                          <span key={t.id} className="mdt-tag rounded-full px-2.5 py-1 text-[10px]">
                            {t.name}
                            {t.isAdult && <span className="ml-1 text-[var(--color-magenta)]">●</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </StoryReveal>

          {/* In-content ad — 2.9K visitors/month on this template */}
          <div className="mdt-ad-slot flex justify-center">
            <AdBanner placement="manga-detail-inline" type="sidebar" />
          </div>

          {/* Chapter list */}
          {entry && showChapters && chapters.length > 0 && (
            <section className="mdt-section mdt-panel">
              <SectionTitle>
                Chapter List
                <span className="mdt-section-count ml-2 text-xs font-mono">
                  {readCount}/{chapters.length} read
                </span>
              </SectionTitle>
              {readProgress > 0 && (
                <div className="mdt-progress-wrap mb-3">
                  <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)] mb-1">
                    <span>Reading Progress</span>
                    <span>{readProgress}%</span>
                  </div>
                  <div className="mdt-progress-track h-1.5 w-full overflow-hidden rounded-full">
                    <div className="mdt-progress-fill h-full rounded-full" style={{ width: `${readProgress}%` }} />
                  </div>
                </div>
              )}
              <div className="mdt-chapter-list max-h-96 overflow-y-auto">
                {(showAllChapters ? chapters : chapters.slice(0, 30)).map((ch) => (
                  <button key={ch.id} onClick={() => markChapter(ch.chapter, !ch.read)}
                    className={`mdt-chapter-row flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      ch.read ? "is-read" : ""
                    }`}
                  >
                    <span className={`mdt-check flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      ch.read ? "bg-green-500 border-green-500" : "border-[var(--color-line)]"
                    }`}>
                      {ch.read && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span className="mdt-chapter-no font-mono text-xs w-12">Ch. {ch.chapter}</span>
                    <span className="flex-1 truncate">{ch.title || `Chapter ${ch.chapter}`}</span>
                    {ch.readAt && <span className="mdt-chapter-date text-[10px]">{new Date(ch.readAt).toLocaleDateString()}</span>}
                  </button>
                ))}
              </div>
              {chapters.length > 30 && (
                <button onClick={() => setShowAllChapters(!showAllChapters)}
                  className="mdt-link-btn mt-2 text-xs"
                >
                  {showAllChapters ? "Show less" : `Show all ${chapters.length} chapters`}
                </button>
              )}
            </section>
          )}

          {/* Rankings */}
          {rankings.length > 0 && (
            <RankingsReveal>
              <section className="mdt-section mdt-rank-section">
                <SectionTitle>Rankings</SectionTitle>
                <div className="mdt-rank-panel">
                  <div className="mdt-rank-grid">
                    {rankings.slice(0, 6).map((r) => (
                      <div key={r.id} className="mdt-rank-card">
                        <div className="mdt-rank-copy">
                          <div className="mdt-rank-num">#{r.rank}</div>
                          <div className="mdt-rank-label">
                            {r.context}{r.year ? ` (${r.year})` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </RankingsReveal>
          )}

          {/* Characters */}
          {chars.length > 0 && (
            <CharactersReveal>
              <section className="mdt-section mdt-char-section">
                <SectionTitle>
                  Characters
                  <span className="mdt-section-count ml-2 text-xs font-mono">{chars.length}</span>
                </SectionTitle>
                <div className="mdt-char-panel">
                  <div className="mdt-people-grid mdt-char-grid grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {chars.map((edge, i) => (
                      <Link key={edge.node.id} href={`/character/${edge.node.id}`}
                        className={`mdt-person mdt-char-card flex items-center gap-2 rounded-lg transition-colors ${
                          edge.role === "MAIN" ? "is-main" : ""
                        }`}
                        style={{ animationDelay: `${Math.min(i, 12) * 0.035}s` }}
                      >
                        <span className="mdt-avatar mdt-char-avatar relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                          <Image src={edge.node.image?.medium || ""} alt={edge.node.name?.full || ""} fill className="object-cover" sizes="32px" />
                        </span>
                        <span className="mdt-char-body min-w-0">
                          <span className="mdt-person-name block truncate">{edge.node.name?.full}</span>
                          <span className="mdt-role mdt-char-role block truncate uppercase tracking-wider">{edge.role}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            </CharactersReveal>
          )}

          {/* Staff */}
          {staffEdges.length > 0 && (
            <StaffReveal>
              <section className="mdt-section mdt-staff-section">
                <SectionTitle>
                  Staff
                  {staffEdges.length > 15 && (
                    <button onClick={() => setShowAllStaff((o) => !o)}
                      className="mdt-link-btn mdt-staff-toggle ml-auto text-[10px] font-mono"
                    >{showAllStaff ? "Show less" : `View all (${staffEdges.length})`}</button>
                  )}
                </SectionTitle>
                <div className="mdt-staff-panel">
                  <div className="mdt-people-grid mdt-staff-grid grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(showAllStaff ? staffEdges : staffEdges.slice(0, 15)).map((s, i) => (
                      <Link key={`${s.node.id}-${i}`} href={`/staff/${s.node.id}`}
                        className={`mdt-person mdt-staff-card flex items-center gap-2 rounded-lg transition-colors ${
                          /story|art/i.test(s.role || "") ? "is-lead" : ""
                        }`}
                        style={{ animationDelay: `${Math.min(i, 12) * 0.035}s` }}
                      >
                        <span className="mdt-avatar mdt-staff-avatar relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                          <Image src={s.node.image?.medium || ""} alt={s.node.name?.full || ""} fill className="object-cover" sizes="32px" />
                        </span>
                        <span className="mdt-staff-body min-w-0">
                          <span className="mdt-person-name block truncate">{s.node.name?.full}</span>
                          <span className="mdt-role mdt-staff-role block truncate">{s.role}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            </StaffReveal>
          )}

          {/* Relations */}
          {relations.length > 0 && (
            <RelatedReveal>
              <section className="mdt-section mdt-rel-section">
                <SectionTitle>
                  Related
                  <span className="mdt-section-count ml-2 text-xs font-mono">{relations.length}</span>
                </SectionTitle>
                <div className="mdt-rel-summary mdt-rel-panel mb-3 flex flex-wrap gap-1.5">
                  {Object.entries(relationCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([kind, count]) => (
                      <span key={kind} className="mdt-rel-chip">
                        {kind.replace(/_/g, " ").toLowerCase()} <b>{count}</b>
                      </span>
                    ))}
                </div>
                <div className="mdt-carousel-frame mdt-rel-carousel is-trending">
                  <Carousel3D
                    items={relations.map((r) => ({
                      id: r.node.id, coverImage: r.node.coverImage, title: r.node.title,
                      averageScore: r.node.averageScore,
                      format: r.node.type === "ANIME" ? `${r.node.episodes || ""} ep` : `${r.node.chapters || ""} ch`,
                      type: r.node.type,
                    }))}
                    accent="violet"
                    size="wide"
                    variant="trending"
                    hrefFn={(item: {id: number; type?: string}) => item.type === "ANIME" ? `/anime/${item.id}` : `/manga/${item.id}`}
                  />
                </div>
              </section>
            </RelatedReveal>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <RecommendationsReveal>
              <section className="mdt-section mdt-rec-section">
                <SectionTitle>
                  You May Also Like
                  <span className="mdt-section-count ml-2 text-xs font-mono">{recs.length}</span>
                </SectionTitle>
                <div className="mdt-carousel-frame mdt-rec-carousel is-trending">
                  <Carousel3D
                    items={recs.map((e) => e.node.mediaRecommendation)}
                    accent="violet"
                    size="wide"
                    variant="trending"
                    hrefFn={(m: {id: number; type?: string}) => m.type === "ANIME" ? `/anime/${m.id}` : `/manga/${m.id}`}
                  />
                </div>
              </section>
            </RecommendationsReveal>
          )}

          {/* Community data — same number of fetches, now manga-correct */}
          <WhyRecsReveal>
            <div className="mdt-subpanel">
              <RecRelationships
                className="mdt-rec-xl"
                mediaId={manga.id}
                type="MANGA"
                malId={manga.idMal ?? undefined}
                fallback={recs.slice(0, 6).map((e) => {
                  const m = e.node?.mediaRecommendation;
                  if (!m?.id || !m.title) return null;
                  return {
                    id: m.id,
                    title: bestTitle(m.title),
                    image: m.coverImage?.medium || m.coverImage?.large || "",
                    reason: "AniList community pick",
                    allReasons: ["AniList community pick"],
                    href: `/manga/${m.id}`,
                  };
                }).filter((r): r is NonNullable<typeof r> => Boolean(r))}
              />
            </div>
          </WhyRecsReveal>
          <div className="mdt-subpanel">
            <UsersAlsoLiked mediaId={manga.id} type="MANGA" />
          </div>
          <div className="mdt-subpanel">
            <DiscussionLinks mediaId={manga.id} title={title} type="MANGA" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="mdt-sidebar space-y-5">
          {/* Ad — kept at the top of the sidebar so the highest-traffic
              template actually gets the impressions */}
          <div className="mdt-ad-slot">
            <AdBanner placement="manga-detail" type="sidebar" />
          </div>

          {entry && (
            <div className="mdt-side-wrap">
              <MangaProgress
                mediaId={Number(id)}
                chapters={entry.chapters}
                volumes={entry.volumes}
                totalChapters={entry.totalChapters}
                totalVolumes={entry.totalVolumes}
                onUpdate={handleProgressUpdate}
              />
            </div>
          )}

          {entry && (
            <div className="mdt-side-wrap">
              <MangaRatingInput
                mediaId={Number(id)}
                currentScore={entry.score}
                onScoreUpdate={handleScoreUpdate}
              />
            </div>
          )}

          <SidebarReveal index={0}>
            <div className="mdt-side-wrap"><MangaReadingHistory mediaId={Number(id)} /></div>
          </SidebarReveal>
          <SidebarReveal index={1}>
            <div className="mdt-side-wrap">
              <MangaStatsCard
                mediaId={manga.id}
                malId={manga.idMal ?? undefined}
                dexId={entry?.mangaDexId ?? undefined}
                title={title}
              />
            </div>
          </SidebarReveal>
          <SidebarReveal index={2}>
            <div className="mdt-side-wrap"><StatusDistribution distribution={statusDist} /></div>
          </SidebarReveal>
          <SidebarReveal index={3}>
            <div className="mdt-side-wrap"><ScoreDistributionChart scoreDistribution={scoreDist} className="mdt-card mdt-score" /></div>
          </SidebarReveal>

          {links.length > 0 && (
            <SidebarReveal index={4}>
              <div className="mdt-card mdt-official">
                <div className="mdt-card-head">
                  <h3 className="font-display text-sm font-bold">Official Sites</h3>
                  <span className="mdt-card-badge">{links.length} links</span>
                </div>
                <ul className="mdt-official-list">
                  {links.map((l, i) => {
                    const host = linkHost(l.url);
                    return (
                      <li key={l.id}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mdt-official-link"
                          style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                        >
                          <span className="mdt-official-mark" aria-hidden>{siteInitial(l.site)}</span>
                          <span className="mdt-official-body">
                            <span className="mdt-official-site">
                              {l.site}
                              {l.notes && <span className="mdt-link-note"> — {l.notes}</span>}
                            </span>
                            {host && <span className="mdt-official-host">{host}</span>}
                          </span>
                          <span className="mdt-link-arrow" aria-hidden>↗</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </SidebarReveal>
          )}

          {manga.favourites ? (
            <SidebarReveal index={5}>
              <div className="mdt-card mdt-fav-card">
                <span className="mdt-fav-halo" aria-hidden />
                <div className="mdt-fav-num">{formatCount(manga.favourites)}</div>
                <div className="mdt-fav-label">Favorites</div>
                <span className="mdt-fav-spark" aria-hidden>♥</span>
                <span className="mdt-fav-source">AniList community</span>
              </div>
            </SidebarReveal>
          ) : null}

          <SidebarReveal index={6}>
            <div className="mdt-card mdt-affiliate-card">
              <div className="mdt-card-head">
                <h3 className="font-display text-xs font-bold">Where to buy</h3>
                <span className="mdt-card-badge">Support us</span>
              </div>
              <div className="mdt-affiliate-list">
                <AffiliateLink partner="amazon" path={`https://www.amazon.in/s?k=${encodeURIComponent(bestTitle(manga.title) + " manga")}`}
                  className="mdt-affiliate-link"
                >
                  <span className="mdt-affiliate-icon">📦</span>
                  <span className="mdt-affiliate-body">
                    <strong>Buy on Amazon</strong>
                    <small>manga search</small>
                  </span>
                  <span className="mdt-affiliate-arrow" aria-hidden>↗</span>
                </AffiliateLink>
                <AffiliateLink partner="bookwalker" path="https://global.bookwalker.jp"
                  className="mdt-affiliate-link"
                >
                  <span className="mdt-affiliate-icon">📚</span>
                  <span className="mdt-affiliate-body">
                    <strong>BookWalker</strong>
                    <small>global store</small>
                  </span>
                  <span className="mdt-affiliate-arrow" aria-hidden>↗</span>
                </AffiliateLink>
                <PlayAsiaPill query={`${bestTitle(manga.title)} manga merch`} label="Play-Asia merch" className="mdt-affiliate-link" />
              </div>
            </div>
          </SidebarReveal>

          <SidebarReveal index={7}>
            <div className="mdt-card mdt-source-note">
              <span className="mdt-source-note-mark" aria-hidden>◎</span>
              <div className="mdt-source-note-body">
                <p>
                  Data from <a href={manga.siteUrl} target="_blank" rel="noopener noreferrer">AniList</a>.
                  {manga.idMal && <> Also on <a href={`https://myanimelist.net/manga/${manga.idMal}`} target="_blank" rel="noopener noreferrer">MyAnimeList</a>.</>}
                </p>
                <span className="mdt-source-note-foot">Live public metadata · no invented numbers</span>
              </div>
            </div>
          </SidebarReveal>
        </aside>
      </div>

      {/* Native Ad Grid */}
      <div className="mdt-ad-block my-8 max-w-7xl mx-auto px-4 sm:px-6">
        <NativeBannerAd />
      </div>

      {/* Bottom Leaderboard Banner */}
      <div className="mdt-ad-block my-6 flex justify-center max-w-7xl mx-auto px-4 sm:px-6">
        <AdBanner placement="manga-bottom" type="banner" />
      </div>
    </div></ErrorBoundary></PageTransition>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mdt-section-title font-display text-xl font-bold mb-4 flex items-center gap-2">
    <span className="mdt-section-bar h-4 w-1 rounded-full" />
    <RevealTitle as="span">{children}</RevealTitle>
  </h2>;
}

function StatusDistribution({
  distribution,
}: {
  distribution: { status: string; amount: number }[];
}) {
  if (!distribution || distribution.length === 0) return null;
  const max = Math.max(...distribution.map((d) => d.amount), 1);
  const total = distribution.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div className="mdt-card mdt-status-dist">
      <div className="mdt-card-head">
        <h3 className="font-display text-sm font-bold">Reader Status</h3>
        <span className="mdt-card-badge">{formatCount(total)} votes</span>
      </div>
      <div className="mdt-dist-meter" aria-hidden>
        {distribution.map((d) => (
          <span
            key={d.status}
            className="mdt-dist-meter-seg"
            style={{ width: total > 0 ? `${(d.amount / total) * 100}%` : "0%" }}
          />
        ))}
      </div>
      <div className="mdt-dist-list">
        {distribution.map((d) => (
          <div key={d.status} className="mdt-dist-row">
            <span className="mdt-dist-label">{STATUS_DIST_LABELS[d.status] || d.status.replace(/_/g, " ")}</span>
            <span className="mdt-dist-track">
              <span className="mdt-dist-fill" style={{ width: `${Math.max(2, (d.amount / max) * 100)}%` }} />
            </span>
            <span className="mdt-dist-amount font-mono">{formatCount(d.amount)}</span>
            <span className="mdt-dist-share font-mono">
              {total > 0 ? `${((d.amount / total) * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mdt-dist-note">AniList community status · real votes</p>
    </div>
  );
}
