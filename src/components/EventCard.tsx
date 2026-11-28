"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import { eventImageSrc } from "@/lib/event-images";
import MiniCalendar from "./MiniCalendar";
import type { AnimeEvent } from "@/lib/anime-events";

const TYPE_CONFIG: Record<string, { icon: string; tone: string }> = {
  expo: { icon: "🎯", tone: "cyan" },
  convention: { icon: "🎪", tone: "violet" },
  stream: { icon: "📺", tone: "blue" },
  festival: { icon: "🎆", tone: "magenta" },
  premiere: { icon: "🎬", tone: "amber" },
};

function reducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function EventCard({ event, index = 0 }: { event: AnimeEvent; index?: number }) {
  const reduceMotion = useReducedMotion();
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const isPast = event.status === "past";
  const isOngoing = event.status === "ongoing";
  const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.convention;

  const dateStr = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const daysUntil = Math.ceil((start.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const countdownText = isPast
    ? "Ended"
    : isOngoing
      ? "Live now"
      : daysUntil === 0
        ? "Today"
        : daysUntil === 1
          ? "Tomorrow"
          : `In ${daysUntil} days`;

  const poster = eventImageSrc(event.image);
  const [posterFailed, setPosterFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
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
    <motion.article
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: (index % 9) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`evp-card evp-card-${event.status}`}
    >
      <div className="evp-card-aura" aria-hidden="true" />
      <div className="evp-card-scan" aria-hidden="true" />
      <span className="evp-card-corner" aria-hidden="true" />
      <div className="evp-card-body">
        <div className="evp-card-media">
          {poster && !posterFailed ? (
            <>
              <Image
                src={poster}
                alt={event.name}
                fill
                onError={() => setPosterFailed(true)}
                className="evp-card-image"
                loading="lazy"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="evp-card-media-fade" />
            </>
          ) : (
            <div className="evp-card-media-fallback">
              <span>{event.country}</span>
            </div>
          )}
          <span className="evp-card-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="evp-card-country">{event.country}</span>
          <span className={`evp-countdown evp-countdown-${event.status}`}>{countdownText}</span>
        </div>

        <div className="evp-card-content">
          <div className="evp-card-badges">
            <span className={`evp-pill evp-pill-${config.tone}`}>
              {config.icon} {event.type}
            </span>
            <span className={`evp-status evp-status-${event.status}`}>{event.status}</span>
          </div>

          <Link href={`/events/${event.slug}`} className="evp-card-link">
            <h3 className="evp-card-title">{event.name}</h3>
            <div className="evp-card-fact">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span title={event.location}>{event.location}</span>
            </div>
            <div className="evp-card-fact">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{dateStr}</span>
            </div>
          </Link>

          <p className="evp-card-description">{event.description}</p>

          {event.tags.length > 0 && (
            <div className="evp-tag-row">
              {event.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="evp-tag">{tag}</span>
              ))}
              {event.tags.length > 3 && <span className="evp-tag-more">+{event.tags.length - 3}</span>}
            </div>
          )}

          <div className="evp-card-actions">
            <MiniCalendar
              startDate={event.startDate}
              endDate={event.endDate}
              name={event.name}
              buttonClassName="evp-calendar-btn"
            />
            {event.website && (
              <a href={event.website} target="_blank" rel="noopener noreferrer" className="evp-site-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Visit site
              </a>
            )}
          </div>

          <div className="evp-card-footer">
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`evp-source evp-source-${event.sourceTone}`}
            >
              <span className="evp-source-dot" />
              {event.sourceLabel}
            </a>
            {event.announcements.length > 0 && (
              <span className="evp-card-note">{event.announcements.length} verified update(s)</span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
