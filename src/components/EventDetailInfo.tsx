"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRef, useCallback } from "react";
import type { AnimeEvent } from "@/lib/anime-events";

const TYPE_TONES: Record<string, string> = {
  expo: "cyan",
  convention: "violet",
  stream: "blue",
  festival: "magenta",
  premiere: "amber",
};

function reducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function TiltCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || reducedMotion()) return;
    const rect = element.getBoundingClientRect();
    const px = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const py = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    element.style.transform = `perspective(900px) rotateY(${px * 4}deg) rotateX(${-py * 4}deg) scale(1.015)`;
  }, []);

  const handlePointerLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`evp-detail-card ${className}`}
    >
      {children}
    </div>
  );
}

export default function EventDetailInfo({ event }: { event: AnimeEvent }) {
  const reduceMotion = useReducedMotion();
  const tone = TYPE_TONES[event.type] || TYPE_TONES.convention;
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const dateStr = `${start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — ${end.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;

  const infos = [
    { icon: "📅", label: "Dates", value: dateStr, tone },
    { icon: "📍", label: "Location", value: `${event.location}, ${event.country}`, tone: "cyan" },
    { icon: "🔗", label: "Source", value: event.sourceLabel, tone: "magenta", href: event.sourceUrl },
  ];

  return (
    <div className="evp-detail">
      <div className="evp-detail-grid">
        {infos.map((info, index) => {
          const content = (
            <>
              <div className="evp-detail-card-head">
                <span className={`evp-detail-accent evp-detail-accent-${info.tone}`} />
                <span aria-hidden="true">{info.icon}</span>
              </div>
              <p className="evp-detail-label">{info.label}</p>
              <p className="evp-detail-value">{info.value}</p>
            </>
          );

          return (
            <motion.div
              key={info.label}
              initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.97 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.42, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              {"href" in info && info.href ? (
                <a href={info.href} target="_blank" rel="noopener noreferrer" className="block h-full">
                  <TiltCard className="h-full">{content}</TiltCard>
                </a>
              ) : (
                <TiltCard className="h-full">{content}</TiltCard>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.97 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="evp-detail-about"
      >
        <TiltCard>
          <div className="evp-detail-about-head">
            <span className={`evp-detail-accent evp-detail-accent-${tone}`} />
            <h3>About this event</h3>
          </div>
          <p>{event.description}</p>
          {event.tags.length > 0 && (
            <div className="evp-tag-row">
              {event.tags.map((tag) => (
                <span key={tag} className="evp-tag">{tag}</span>
              ))}
            </div>
          )}
        </TiltCard>
      </motion.div>
    </div>
  );
}
