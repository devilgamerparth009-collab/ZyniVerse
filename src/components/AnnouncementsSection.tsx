"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { eventImageSrc } from "@/lib/event-images";
import TrailerModal from "@/components/TrailerModal";
import type { AnimeEvent } from "@/lib/anime-events";

const CATEGORIES = [
  { value: "all", label: "All", icon: "🔥" },
  { value: "trailer", label: "Trailers", icon: "🎬" },
  { value: "movie-reveal", label: "Movies", icon: "🎥" },
  { value: "anime-reveal", label: "New Anime", icon: "✨" },
  { value: "season-announcement", label: "Seasons", icon: "📺" },
  { value: "key-visual", label: "Key Visuals", icon: "🖼️" },
  { value: "collab", label: "Collabs", icon: "🤝" },
];

const CATEGORY_TONES: Record<string, string> = {
  "anime-reveal": "cyan",
  "season-announcement": "green",
  "movie-reveal": "violet",
  "game-reveal": "blue",
  collab: "magenta",
  trailer: "amber",
  "key-visual": "orange",
  casting: "indigo",
  merchandise: "rose",
  other: "muted",
};

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ThumbImg({
  src,
  ytId,
  alt,
}: {
  src: string;
  ytId: string | null;
  alt: string;
}) {
  const [srcState, setSrcState] = useState(src);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return <div className="evp-ann-thumb-fallback" />;
  }

  return (
    <Image
      src={srcState}
      alt={alt}
      fill
      className="evp-ann-image"
      loading="lazy"
      sizes="(max-width: 768px) 100vw, 500px"
      onError={() => {
        if (ytId && srcState.includes("maxresdefault")) {
          setSrcState(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
        } else {
          setHidden(true);
        }
      }}
    />
  );
}

interface AnnouncementCardData {
  id: string;
  title: string;
  description: string;
  category: string;
  trailerUrl?: string;
  posterUrl?: string;
  sourceUrl?: string;
  eventSlug: string;
  eventName: string;
  eventDate: string;
  eventImage?: string;
}

function AnnouncementCard({ item, index }: { item: AnnouncementCardData; index: number }) {
  const reduceMotion = useReducedMotion();
  const ytId = item.trailerUrl ? extractYouTubeId(item.trailerUrl) : null;
  const thumbUrl = ytId
    ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
    : eventImageSrc(item.posterUrl || item.eventImage);
  const tone = CATEGORY_TONES[item.category] || CATEGORY_TONES.other;
  const ref = useRef<HTMLElement>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const py = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    el.style.transform = `perspective(900px) rotateY(${px * 4}deg) rotateX(${-py * 4}deg) scale(1.015)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  return (
    <>
      <motion.article
        ref={ref}
        initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.97 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.97 }}
        transition={{ duration: 0.42, delay: (index % 9) * 0.06, ease: [0.22, 1, 0.36, 1] }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="evp-ann-card"
      >
        <div className="evp-ann-body">
          {thumbUrl && (
            <div className="evp-ann-media">
              <ThumbImg src={thumbUrl} ytId={ytId} alt={item.title} />
              <div className="evp-ann-media-fade" />
              {ytId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTrailerOpen(true);
                  }}
                  className="evp-ann-play"
                  aria-label={`Watch trailer for ${item.title}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}
              <span className={`evp-pill evp-pill-${tone} evp-ann-category`}>
                {item.category.replace(/-/g, " ")}
              </span>
            </div>
          )}

          <div className="evp-ann-content">
            <h4 className="evp-ann-title">
              <Link href={`/events/${item.eventSlug}`}>{item.title}</Link>
            </h4>
            <p className="evp-ann-description">{item.description}</p>
            <div className="evp-ann-footer">
              <span className="evp-ann-event">{item.eventName}</span>
              <span className="evp-ann-date">
                {new Date(item.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="evp-source evp-source-official evp-ann-source"
              >
                <span className="evp-source-dot" />
                View source
              </a>
            )}
          </div>
        </div>
      </motion.article>
      <TrailerModal
        url={trailerOpen ? item.trailerUrl ?? null : null}
        onClose={() => setTrailerOpen(false)}
      />
    </>
  );
}

export default function AnnouncementsSection({
  events,
}: {
  events: AnimeEvent[];
}) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const allAnnouncements = events.flatMap((event) =>
    event.announcements
      .filter((announcement) => Boolean(announcement.sourceUrl?.trim()))
      .map((announcement) => ({
        ...announcement,
        eventSlug: event.slug,
        eventName: event.name,
        eventDate: event.startDate,
        eventImage: event.image,
      }))
  );

  const filtered = allAnnouncements.filter((announcement) => {
    if (category !== "all" && announcement.category !== category) return false;
    if (search) {
      const needle = search.toLowerCase();
      if (
        !announcement.title.toLowerCase().includes(needle) &&
        !announcement.description.toLowerCase().includes(needle) &&
        !announcement.eventName.toLowerCase().includes(needle)
      ) {
        return false;
      }
    }
    return true;
  });

  const categoryCount = (value: string) =>
    value === "all"
      ? allAnnouncements.length
      : allAnnouncements.filter((announcement) => announcement.category === value).length;

  return (
    <div className="evp-ann-wrap">
      <div className="evp-filter-top evp-filter-top-ann">
        <label className="evp-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search verified announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="evp-segments evp-segments-wrap">
          {CATEGORIES.map((item) => {
            const count = categoryCount(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`evp-segment ${category === item.value ? "evp-segment-active" : ""}`}
              >
                <span>{item.icon}</span>
                {item.label}
                <span className="evp-segment-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="evp-ann-empty">
          <span className="evp-empty-icon">⌁</span>
          <p>No verified announcements to show right now.</p>
          <p className="evp-empty-sub">We only publish updates linked to a traceable source.</p>
        </div>
      ) : (
        <motion.div className="evp-card-grid">
          <AnimatePresence mode="popLayout">
            {filtered.map((announcement, index) => (
              <AnnouncementCard key={announcement.id} item={announcement} index={index} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
