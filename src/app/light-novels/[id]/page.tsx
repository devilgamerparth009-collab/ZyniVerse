"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getMangaDetailFull, bestTitle } from "@/lib/anilist";
import Loader, { ErrorState } from "@/components/Loader";
import RevealTitle from "@/components/RevealTitle";
import { DynamicCarousel3D as Carousel3D } from "@/components/lazy";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import MangaProgress from "@/components/MangaProgress";
import AffiliateLink from "@/components/AffiliateLink";
import PlayAsiaPill from "@/components/PlayAsiaPill";
import ShareButton from "@/components/ShareButton";
import AdBanner from "@/components/AdBanner";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/manga";
import type { MediaMangaFull } from "@/lib/anilist";
import { logError } from "@/lib/logger";

function stripHtml(str: string | null | undefined = "") { return str ? str.replace(/<[^>]*>/g, "") : ""; }
function formatScore(score?: number) { return score ? (score / 10).toFixed(1) : "—"; }

// Some AniList entries only carry a native-script title. Show the readable
// romanized/Latin title instead and keep the source value as a tooltip.
function readableNative(native: string | undefined | null, fallback: string) {
  if (!native) return "";
  const foreignScript = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]/;
  return foreignScript.test(native) ? fallback : native;
}

const COUNTRY_LABELS: Record<string, string> = { JP: "Japan" };

// Route a related/recommended title to its correct detail page. Light novels
// (format === "NOVEL") live under /light-novels, not /manga.
function mediaHref(item: { id: number; type?: string; format?: string; mediaFormat?: string | null }) {
  if (item.type === "ANIME") return `/anime/${item.id}`;
  return (item.mediaFormat ?? item.format) === "NOVEL" ? `/light-novels/${item.id}` : `/manga/${item.id}`;
}

interface LightNovelEntryDB {
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
}

interface MangaChapterDB {
  id: string;
  chapter: number;
  title: string | null;
  read: boolean;
  readAt: string | null;
}

const STATUS_OPTIONS = ["READING", "COMPLETED", "PLANNING", "DROPPED", "PAUSED", "REREADING"];

export default function LightNovelDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [ln, setLn] = useState<MediaMangaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [entry, setEntry] = useState<LightNovelEntryDB | null>(null);
  const [chapters, setChapters] = useState<MangaChapterDB[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("PLANNING");

  async function fetchEntry() {
    try {
      const res = await fetch(`/api/light-novels/list/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntry(data.entry);
    } catch (e) { logError(e); }
  }

  async function fetchChapters() {
    try {
      const res = await fetch(`/api/light-novels/chapters?mediaId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setChapters(data.chapters || []);
      setShowChapters(true);
    } catch (e) { logError(e); }
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(null); setLn(null);
    window.scrollTo(0, 0);
    Promise.all([
      getMangaDetailFull(id!),
      fetch(`/api/light-novels/list/${id}`).then((r) => r.ok ? r.json() : { entry: null }).catch(() => ({ entry: null })),
    ])
      .then(([m, d]) => {
        if (!cancelled) {
          setLn(m);
          setEntry(d.entry || null);
          if (d.entry) {
            setShowChapters(true);
            fetchChapters();
          }
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchChapters recreated per render; only depends on id
  }, [id]);

  async function addToList(status: string) {
    if (!ln) return;
    try {
      const res = await fetch("/api/light-novels/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: ln.id,
          title: bestTitle(ln.title),
          coverImage: ln.coverImage?.extraLarge || ln.coverImage?.large,
          status,
          totalChapters: ln.chapters,
          totalVolumes: ln.volumes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data.entry);
        fetchChapters();
      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch (e) {
      console.error("Failed to add light novel", e);
    }
  }

  async function removeFromList() {
    try {
      const res = await fetch("/api/light-novels/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: Number(id) }),
      });
      if (res.ok) {
        setEntry(null);
        setChapters([]);
        setShowChapters(false);
      }
    } catch (e) {
      console.error("Failed to remove light novel", e);
    }
  }

  async function handleStatusChange(status: string) {
    try {
      const res = await fetch(`/api/light-novels/list/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntry(data.entry);
      }
    } catch (e) {
      console.error("Failed to update status", e);
    }
  }

  async function markChapter(chapter: number, read: boolean) {
    try {
      const res = await fetch("/api/light-novels/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: Number(id), chapter, read }),
      });
      if (res.ok) {
        fetchChapters();
        fetchEntry();
      }
    } catch (e) {
      console.error("Failed to mark chapter", e);
    }
  }

  function handleProgressUpdate(chapters: number, volumes: number) {
    setEntry((prev) => prev ? { ...prev, chapters, volumes } : prev);
  }

  if (loading) return <Loader label="Loading light novel details..." />;
  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState message={error} /></div>;
  if (!ln) return null;

  const title = bestTitle(ln.title);
  const nativeTitle = readableNative(ln.title.native, title);
  const chars = ln.characters?.edges || [];
  const staffEdges = ln.staff?.edges || [];
  const links = (ln.externalLinks || []).filter((l) => !l.isDisabled);
  const relations = (ln.relations?.edges || []).filter(
    (e) => ["SEQUEL", "PREQUEL", "SIDE_STORY", "ALTERNATIVE", "SUMMARY", "ADAPTATION", "SOURCE"].includes(e.relationType)
  );
  const recs = ln.recommendations?.edges || [];
  const rankings = ln.rankings || [];
  const scoreDist = ln.stats?.scoreDistribution || [];

  return (
    <PageTransition><ErrorBoundary label="LightNovelDetails"><div className="lnh-page">
      {/* Hero */}
      <div className="lnh-hero relative border-b border-[var(--color-line)]">
        <span className="lnh-hero-grid" aria-hidden="true" />
        <span className="lnh-hero-orb lnh-hero-orb-a" aria-hidden="true" />
        <span className="lnh-hero-orb lnh-hero-orb-b" aria-hidden="true" />
        <span className="lnh-hero-scan" aria-hidden="true" />
        {ln.bannerImage && (
          <motion.div className="lnh-banner absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <div className="relative h-full w-full">
              <Image src={ln.bannerImage} alt="" fill loading="eager" fetchPriority="high" className="object-cover opacity-20" sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-void)] via-[var(--color-void)]/80 to-[var(--color-void)]/30" />
          </motion.div>
        )}

        <div className="lnh-hero-inner relative mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-10 sm:flex-row sm:px-6 sm:py-14">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -6, transition: { duration: 0.25, ease: "easeOut" } }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="lnh-cover relative shrink-0 h-64 w-44 sm:h-80 sm:w-56 rounded-xl border border-[var(--color-line)] shadow-2xl overflow-hidden"
          >
            <Image
              src={ln.coverImage?.large || ln.coverImage?.extraLarge || ""}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </motion.div>

          <div className="lnh-copy min-w-0 flex-1">
            <span className="lnh-kicker mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-cyan)]/20 px-2.5 py-1 text-xs font-bold text-[var(--color-cyan)] uppercase tracking-wider">
              <span className="lnh-kicker-dot" aria-hidden="true" />
              Light Novel
              <span className="lnh-kicker-rule" aria-hidden="true" />
            </span>
            <RevealTitle as="h1" text={title} className="lnh-title font-display text-3xl font-bold leading-tight sm:text-5xl mt-2" />
            <span className="lnh-title-rule" aria-hidden="true" />
            {nativeTitle && (
              <p
                className="lnh-native mt-1 text-[var(--color-mute)]"
                title={ln.title.native && ln.title.native !== nativeTitle ? ln.title.native : undefined}
              >
                {nativeTitle}
              </p>
            )}

            <div className="lnh-genres mt-4 flex flex-wrap gap-2">
              {ln.genres?.map((g, index) => (
                <Link key={g} href={`/search?genre=${g}&type=MANGA&format=NOVEL`}
                  className="lnh-chip rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-mute)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)] transition-colors"
                  style={{ animationDelay: `${80 + index * 55}ms` }}
                >{g}</Link>
              ))}
            </div>

            <div className="lnh-stats mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--color-mute)]">
              {ln.averageScore ? (
                <span className="lnh-stat lnh-stat-score font-mono text-[var(--color-cyan)]">★ {formatScore(ln.averageScore)}</span>
              ) : null}
              {ln.chapters ? <span className="lnh-stat">{ln.chapters} ch</span> : null}
              {ln.volumes ? <span className="lnh-stat">{ln.volumes} vol</span> : null}
              {ln.source ? <span className="lnh-stat text-[10px] uppercase">{ln.source.replace(/_/g, " ")}</span> : null}
              {ln.countryOfOrigin ? (
                <span
                  className="lnh-stat"
                  title={ln.countryOfOrigin !== (COUNTRY_LABELS[ln.countryOfOrigin] ?? ln.countryOfOrigin) ? ln.countryOfOrigin : undefined}
                >
                  {COUNTRY_LABELS[ln.countryOfOrigin] ?? ln.countryOfOrigin}
                </span>
              ) : null}
              {ln.startDate?.year ? (
                <span className="lnh-stat">
                  {ln.startDate.year}
                  {ln.endDate?.year ? ` — ${ln.endDate.year}` : ln.status === "RELEASING" ? " — Present" : ""}
                </span>
              ) : null}
            </div>

            {/* Add to List / Status selector */}
            <div className="lnh-actions mt-6 flex flex-wrap items-center gap-3">
              {entry ? (
                <>
                  <span className="lnh-status-pill rounded-full px-3 py-1 text-xs font-semibold text-black"
                    style={{ backgroundColor: STATUS_COLORS[entry.status] || "var(--color-mute)" }}
                  >{STATUS_LABELS[entry.status] || entry.status}</span>
                  <select value={entry.status} onChange={(e) => handleStatusChange(e.target.value)}
                    className="lnh-select rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-cyan)]"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                  </select>
                  <button onClick={removeFromList}
                    className="lnh-remove rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >Remove</button>
                  {entry && (
                    <span className="lnh-progress text-xs text-[var(--color-mute)]">
                      Ch: {entry.chapters}{entry.totalChapters ? `/${entry.totalChapters}` : ""}
                      {entry.volumes > 0 && ` | Vol: ${entry.volumes}${entry.totalVolumes ? `/${entry.totalVolumes}` : ""}`}
                    </span>
                  )}
                </>
              ) : session?.user?.id ? (
                <>
                  <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                    className="lnh-select rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-cyan)]"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                  </select>
                  <button onClick={() => addToList(selectedStatus)}
                    className="lnh-primary rounded-full bg-[var(--color-cyan)] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                  >Add to My List</button>
                </>
              ) : (
                <Link href="/login"
                  className="lnh-primary rounded-full bg-[var(--color-cyan)] px-5 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                >Sign in to track</Link>
              )}
              <span className="lnh-share">
                <ShareButton
                  mediaId={ln.id}
                  title={title}
                  href={`https://zyverse.in/light-novels/${ln.id}`}
                  kind="novel"
                />
              </span>
            </div>
            <span className="lnh-hero-rule" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-12 min-w-0">
          {/* Story */}
          <Reveal className="lnst-story">
            <div className="lnst-panel">
              <span className="lnst-aura" aria-hidden="true" />
              <SectionTitle>Story</SectionTitle>
              <div className="lnst-copy-wrap">
                <span className="lnst-quote" aria-hidden="true">“</span>
                <p className="lnst-description leading-relaxed text-[var(--color-mute)] whitespace-pre-line">
                  {stripHtml(ln.description) || "No description available."}
                </p>
              </div>
              {ln.tags && ln.tags.length > 0 && (
                <div className="lnst-tags">
                  {ln.tags.filter((t) => t.rank >= 60 && !t.isMediaSpoiler).slice(0, 12).map((t, index) => (
                    <span key={t.id} className="lnst-tag" style={{ animationDelay: `${60 + index * 45}ms` }}>
                      {t.name}
                      {t.isAdult && <span className="lnst-tag-adult">●</span>}
                    </span>
                  ))}
                </div>
              )}
              <div className="lnst-footer" aria-hidden="true">
                <span className="lnst-line" />
                <span className="lnst-node" />
              </div>
            </div>
          </Reveal>

          {/* In-content Adsterra slot */}
          <div className="lnad-slot lnad-inline">
            <AdBanner placement="light-novel-detail-inline" type="sidebar" />
          </div>

          {/* Chapter list */}
          {entry && showChapters && chapters.length > 0 && (
            <Reveal>
              <SectionTitle>Chapter List</SectionTitle>
              <div className="rounded-xl border border-[var(--color-line)] divide-y divide-[var(--color-line)] max-h-80 overflow-y-auto">
                {chapters.map((ch) => (
                  <button key={ch.id} onClick={() => markChapter(ch.chapter, !ch.read)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 ${
                      ch.read ? "opacity-50" : ""
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      ch.read ? "bg-cyan-500 border-cyan-500" : "border-[var(--color-line)]"
                    }`}>
                      {ch.read && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[var(--color-mute)] w-12">Ch. {ch.chapter}</span>
                    <span className="flex-1 truncate">{ch.title || `Chapter ${ch.chapter}`}</span>
                    {ch.readAt && <span className="text-[10px] text-[var(--color-mute)]">{new Date(ch.readAt).toLocaleDateString()}</span>}
                  </button>
                ))}
              </div>
            </Reveal>
          )}

          {/* Rankings */}
          {rankings.length > 0 && (
            <Reveal className="lnst-rank">
              <div className="lnst-rank-panel">
                <span className="lnst-rank-aura" aria-hidden="true" />
                <SectionTitle>Rankings</SectionTitle>
                <div className="lnst-rank-grid grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  {rankings.slice(0, 6).map((r, index) => (
                    <div key={r.id} className="lnst-rank-card" style={{ animationDelay: `${80 + index * 70}ms` }}>
                      <span className="lnst-rank-shine" aria-hidden="true" />
                      <div className="lnst-rank-num">#{r.rank}</div>
                      <div className="lnst-rank-context">
                        {r.context}{r.year ? ` (${r.year})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {/* Characters */}
          {chars.length > 0 && (
            <Reveal className="lncs-characters">
              <div className="lncs-panel lncs-chars">
                <span className="lncs-aura" aria-hidden="true" />
                <SectionTitle>Characters</SectionTitle>
                <div className="lncs-grid grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  {chars.slice(0, 20).map((edge, index) => (
                    <Link key={edge.node.id} href={`/character/${edge.node.id}`}
                      className={`lncs-card ${edge.role === "MAIN" ? "lncs-card-main" : "lncs-card-support"}`}
                      style={{ animationDelay: `${60 + index * 35}ms` }}
                    >
                      <div className="lncs-avatar relative h-10 w-10 rounded-full overflow-hidden border border-[var(--color-line)] shrink-0">
                        <Image src={edge.node.image?.medium || ""} alt={edge.node.name?.full || ""} fill className="object-cover" sizes="40px" />
                        <span className="lncs-avatar-ring" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="lncs-name text-xs font-medium truncate">{edge.node.name?.full}</p>
                        <p className="lncs-role">{edge.role}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {/* Staff */}
          {staffEdges.length > 0 && (
            <Reveal className="lncs-staff">
              <div className="lncs-panel lncs-staff-panel">
                <span className="lncs-aura" aria-hidden="true" />
                <SectionTitle>
                  Staff
                  {staffEdges.length > 15 && (
                    <button onClick={() => setShowAllStaff((o) => !o)}
                      className="lncs-toggle ml-auto text-[10px] font-mono text-[var(--color-mute)] hover:text-[var(--color-cyan)] transition-colors"
                    >{showAllStaff ? "Show less" : `View all (${staffEdges.length})`}</button>
                  )}
                </SectionTitle>
                <div className="lncs-grid grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                  {(showAllStaff ? staffEdges : staffEdges.slice(0, 15)).map((s, i) => (
                    <Link key={`${s.node.id}-${i}`} href={`/staff/${s.node.id}`}
                      className="lncs-card lncs-card-staff"
                      style={{ animationDelay: `${60 + i * 35}ms` }}
                    >
                      <div className="lncs-avatar relative h-10 w-10 rounded-full overflow-hidden shrink-0">
                        <Image src={s.node.image?.medium || ""} alt={s.node.name?.full || ""} fill className="object-cover" sizes="40px" />
                        <span className="lncs-avatar-ring" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="lncs-name text-xs font-medium truncate">{s.node.name?.full}</p>
                        <p className="lncs-role lncs-role-full">{s.role}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {/* Relations */}
          {relations.length > 0 && (
            <Reveal className="lncr-related">
              <div className="lncr-panel lncr-rel">
                <span className="lncr-aura" aria-hidden="true" />
                <SectionTitle>Related</SectionTitle>
                <div className="lncr-carousel">
                  <Carousel3D
                    items={relations.map((r) => ({
                      id: r.node.id, coverImage: r.node.coverImage, title: r.node.title,
                      averageScore: r.node.averageScore,
                      format: r.node.type === "ANIME" ? `${r.node.episodes || ""} ep` : `${r.node.chapters || ""} ch`,
                      mediaFormat: r.node.format,
                      type: r.node.type,
                    }))}
                    accent="magenta"
                    hrefFn={mediaHref}
                  />
                </div>
                <span className="lncr-rail" aria-hidden="true" />
              </div>
            </Reveal>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <Reveal className="lncr-recs">
              <div className="lncr-panel lncr-rec">
                <span className="lncr-aura" aria-hidden="true" />
                <SectionTitle>You May Also Like</SectionTitle>
                <div className="lncr-carousel">
                  <Carousel3D
                    items={recs.map((e) => e.node.mediaRecommendation)}
                    accent="magenta"
                    hrefFn={mediaHref}
                  />
                </div>
                <span className="lncr-rail" aria-hidden="true" />
              </div>
            </Reveal>
          )}

          {/* Bottom Adsterra slot */}
          <div className="lnad-slot lnad-bottom">
            <AdBanner placement="light-novel-bottom" type="banner" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lnsb-sidebar space-y-6 lg:sticky lg:top-24 lg:self-start">
          {/* Progress (when added to list) */}
          {entry && (
            <MangaProgress
              mediaId={Number(id)}
              apiBase="/api/light-novels/list"
              chapters={entry.chapters}
              volumes={entry.volumes}
              totalChapters={entry.totalChapters}
              totalVolumes={entry.totalVolumes}
              onUpdate={handleProgressUpdate}
            />
          )}

          {/* Sidebar Adsterra slot */}
          <div className="lnad-slot lnad-side">
            <AdBanner placement="light-novel-detail" type="sidebar" />
          </div>

          {/* Buy / Affiliate */}
          <div className="lnsb-panel lnsb-buy">
            <span className="lnsb-aura" aria-hidden="true" />
            <h3 className="lnsb-title font-display text-sm font-bold mb-3">Buy this Light Novel</h3>
            <div className="lnsb-buy-links flex flex-col gap-2">
              <AffiliateLink
                partner="amazon"
                path={`https://www.amazon.in/s?k=${encodeURIComponent(`${title} light novel`)}`}
                className="lnsb-buy-btn lnsb-buy-amazon inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff9900] to-[#ff5c00] px-4 py-2 text-xs font-bold text-black hover:opacity-90 transition-opacity"
              >📦 Buy on Amazon</AffiliateLink>
              <AffiliateLink
                partner="bookwalker"
                path={`https://global.bookwalker.jp/search/?word=${encodeURIComponent(title)}`}
                className="lnsb-buy-btn lnsb-buy-bookwalker inline-flex items-center justify-center gap-2 rounded-full neon-rgb-border px-4 py-2 text-xs font-semibold text-[var(--color-mute)] hover:text-[#00ffff] transition-colors"
              >📖 Buy on BookWalker</AffiliateLink>
              <div className="lnsb-playasia">
                <PlayAsiaPill query={`${title} light novel`} label="Play-Asia merch" className="justify-center" />
              </div>
            </div>
          </div>

          {/* External Links */}
          {links.length > 0 && (
            <div className="lnsb-panel lnsb-links-panel">
              <span className="lnsb-aura" aria-hidden="true" />
              <h3 className="lnsb-title font-display text-sm font-bold mb-3">Official Sites</h3>
              <ul className="lnsb-link-list space-y-1">
                {links.map((l) => (
                  <li key={l.id} className="lnsb-link-item">
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="lnsb-link flex items-center gap-2 rounded px-2 py-1 text-xs text-[var(--color-mute)] hover:text-[var(--color-cyan)]"
                    >
                      <span>{l.site}</span>
                      {l.notes && <span className="lnsb-link-note text-[9px] opacity-60">— {l.notes}</span>}
                      <span className="lnsb-link-arrow ml-auto">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score Distribution */}
          {scoreDist.length > 0 && (
            <div className="lnsb-panel lnsb-score">
              <span className="lnsb-aura" aria-hidden="true" />
              <h3 className="lnsb-title font-display text-sm font-bold mb-3">Score Distribution</h3>
              <div className="lnsb-score-list space-y-1">
                {scoreDist.filter((s) => s.amount > 0).slice(0, 10).map((s, index) => (
                  <div key={s.score} className="lnsb-score-row flex items-center gap-2 text-[11px]" style={{ animationDelay: `${40 + index * 45}ms` }}>
                    <span className="lnsb-score-pct text-right font-mono text-[var(--color-mute)]">{s.score * 10}%</span>
                    <div className="lnsb-score-track flex-1 h-2 rounded-full bg-[var(--color-line)] overflow-hidden">
                      <motion.div
                        className="lnsb-score-fill h-full rounded-full bg-[var(--color-cyan)]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.min(100, (s.amount / Math.max(...scoreDist.map((d) => d.amount))) * 100)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="lnsb-score-amount text-right font-mono text-[var(--color-mute)]">{s.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ln.favourites ? (
            <div className="lnsb-panel lnsb-fav text-center">
              <span className="lnsb-aura" aria-hidden="true" />
              <div className="lnsb-fav-num text-2xl font-bold font-mono text-[var(--color-magenta)]">{ln.favourites.toLocaleString()}</div>
              <div className="lnsb-fav-label text-xs text-[var(--color-mute)] mt-0.5">Favorites</div>
            </div>
          ) : null}

          <div className="lnsb-panel lnsb-data text-xs text-[var(--color-mute)]">
            <span className="lnsb-aura" aria-hidden="true" />
            Data from <a href={ln.siteUrl} target="_blank" rel="noopener noreferrer" className="lnsb-data-link underline hover:text-[var(--color-cyan)]">AniList</a>.
            {ln.idMal && <> Also on <a href={`https://myanimelist.net/manga/${ln.idMal}`} target="_blank" rel="noopener noreferrer" className="lnsb-data-link underline hover:text-[var(--color-cyan)]">MyAnimeList</a>.</>}
          </div>
        </aside>
      </div>
    </div></ErrorBoundary></PageTransition>
  );
}

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
    <span className="h-4 w-1 rounded-full bg-[var(--color-cyan)]" />
    <RevealTitle as="span">{children}</RevealTitle>
  </h2>;
}
