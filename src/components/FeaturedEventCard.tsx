"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, useCallback } from "react";
import { eventImageSrc } from "@/lib/event-images";
import type { AnimeEvent } from "@/lib/anime-events";
import EventCountdown from "./EventCountdown";
import MiniCalendar from "./MiniCalendar";

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

interface FeaturedEventCardProps {
  event: AnimeEvent;
  position?: number;
  total?: number;
}

export default function FeaturedEventCard({
  event,
  position = 1,
  total = 1,
}: FeaturedEventCardProps) {
  const reduceMotion = useReducedMotion();
  const eventPoster = eventImageSrc(event.image);
  const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.convention;
  const ref = useRef<HTMLDivElement>(null);
  const safePosition = Math.max(1, position);
  const safeTotal = Math.max(safePosition, total);
  const sequence = String(safePosition).padStart(2, "0");
  const sequenceTotal = String(safeTotal).padStart(2, "0");

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const py = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    el.style.transform = `perspective(1100px) rotateY(${px * 3}deg) rotateX(${-py * 3}deg) scale(1.008)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(1100px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  return (
    <motion.article
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="evp-featured"
    >
      <div className="evp-featured-aura" aria-hidden="true" />
      <div className="evp-featured-scan" aria-hidden="true" />
      <span className="evp-featured-corner evp-featured-corner-tl" aria-hidden="true" />
      <span className="evp-featured-corner evp-featured-corner-br" aria-hidden="true" />
      <div className="evp-featured-top" aria-hidden="true">
        <span className="evp-featured-seq">
          {sequence} <i>/</i> {sequenceTotal}
        </span>
        <span className="evp-featured-track">
          {Array.from({ length: Math.min(safeTotal, 5) }, (_, index) => (
            <i key={index} className={index < safePosition ? "is-active" : ""} />
          ))}
        </span>
      </div>
      <div className="evp-featured-inner">
        {eventPoster && (
          <div className="evp-featured-media">
            <Image
              src={eventPoster}
              alt={event.name}
              fill
              priority
              className="evp-featured-image"
              sizes="100vw"
            />
            <div className="evp-featured-media-fade" />
            <span className="evp-featured-country">{event.country}</span>
          </div>
        )}

        <div className="evp-featured-content">
          <div className="evp-card-badges">
            <span className={`evp-pill evp-pill-${config.tone}`}>
              {config.icon} {event.type}
            </span>
            <span className="evp-status evp-status-upcoming">Next up</span>
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`evp-source evp-source-${event.sourceTone}`}
            >
              <span className="evp-source-dot" />
              {event.sourceLabel}
            </a>
          </div>

          <div className="evp-featured-grid">
            <div className="evp-featured-info">
              <h3 className="evp-featured-title">{event.name}</h3>
              <div className="evp-card-fact">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{event.location}</span>
              </div>
              <div className="evp-card-fact">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>
                  {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} —{" "}
                  {new Date(event.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="evp-featured-description">{event.description}</p>
            </div>

            <div className="evp-countdown-panel">
              <p className="evp-countdown-label">
                <span className="evp-countdown-pulse" />
                Starts in
              </p>
              <EventCountdown target={event.startDate} />
              <p className="evp-countdown-foot">live countdown · auto-updates</p>
            </div>
          </div>

          {event.tags.length > 0 && (
            <div className="evp-tag-row">
              <span className="evp-tag-label">signals</span>
              {event.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="evp-tag">{tag}</span>
              ))}
              {event.tags.length > 4 && <span className="evp-tag-more">+{event.tags.length - 4}</span>}
            </div>
          )}

          <div className="evp-featured-actions">
            <MiniCalendar
              startDate={event.startDate}
              endDate={event.endDate}
              name={event.name}
              buttonClassName="evp-calendar-btn"
            />
            <a href={event.website} target="_blank" rel="noopener noreferrer" className="evp-site-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Visit site
            </a>
            <a href={`/events/${event.slug}`} className="evp-detail-link">
              View details
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
