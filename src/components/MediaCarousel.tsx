"use client";

import { useRef, useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { bestTitle } from "@/lib/anilist";
import type { Media } from "@/lib/anilist";

export default function MediaCarousel({
  eyebrow,
  title,
  viewAllTo,
  rows = 1,
  items,
}: {
  eyebrow?: string;
  title: string;
  viewAllTo?: string;
  rows?: number;
  items: Media[];
}) {
  if (items.length === 0) return null;

  const itemsPerRow = Math.ceil(items.length / rows);
  const rowItems = Array.from({ length: rows }, (_, i) =>
    items.slice(i * itemsPerRow, (i + 1) * itemsPerRow)
  );

  return (
    <section className="mpop-section" aria-labelledby="mpop-title">
      <span className="mpop-halo" aria-hidden="true" />
      <span className="mpop-beam" aria-hidden="true" />

      <div className="mpop-shell">
        <div className="mpop-head">
          <div>
            {eyebrow && (
              <p className="mpop-eyebrow">
                <span className="mpop-eyebrow-dot" aria-hidden="true" />
                {eyebrow}
              </p>
            )}
            <h2 id="mpop-title" className="mpop-title">{title}</h2>
            <span className="mpop-title-line" aria-hidden="true" />
          </div>

          <div className="mpop-head-side">
            <span className="mpop-count">
              <strong>{String(items.length).padStart(2, "0")}</strong>
              <span>{items.length === 1 ? "title" : "titles"}</span>
            </span>
            {viewAllTo && (
              <Link href={viewAllTo} className="mpop-viewall">
                View all <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>

        <div className="mpop-rows">
          {rowItems.map((row, ri) => (
            <div
              key={ri}
              className="mpop-row-wrap"
              style={{ "--mpop-row": ri } as CSSProperties}
            >
              <CarouselRow items={row} startIndex={ri * itemsPerRow} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CarouselRow({
  items,
  startIndex,
}: {
  items: Media[];
  startIndex: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 600);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="mpop-row group/mpop">
      <div ref={scrollRef} className="mpop-track">
        {items.map((item, i) => (
          <CarouselCard
            key={item.id}
            item={item}
            rank={startIndex + i + 1}
            index={i}
          />
        ))}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="mpop-nav mpop-nav--left"
          aria-label="Scroll left"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="mpop-nav mpop-nav--right"
          aria-label="Scroll right"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

function CarouselCard({
  item,
  rank,
  index,
}: {
  item: Media;
  rank: number;
  index: number;
}) {
  const title = bestTitle(item.title);
  const href = item.type === "MANGA" ? `/manga/${item.id}` : `/anime/${item.id}`;
  const score = item.averageScore ? (item.averageScore / 10).toFixed(1) : null;
  const format = item.format ? item.format.replace(/_/g, " ") : null;
  const tierClass = rank <= 3 ? ` mpop-card--tier-${rank}` : "";

  return (
    <Link
      href={href}
      aria-label={title}
      className={`mpop-card${tierClass}`}
      style={
        {
          "--mpop-i": Math.min(index, 8),
          "--mpop-fill": item.averageScore ? item.averageScore / 100 : 0,
        } as CSSProperties
      }
    >
      <div className="mpop-poster">
        <Image
          src={item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || ""}
          alt=""
          fill
          className="mpop-img"
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 180px"
        />
        <span className="mpop-sheen" aria-hidden="true" />
        <span className="mpop-stripe" aria-hidden="true" />
        <span className={`mpop-rank ${rank <= 3 ? "mpop-rank--top" : ""}`}>
          #{String(rank).padStart(2, "0")}
        </span>
        {score && (
          <span className="mpop-score">
            <span aria-hidden="true">★</span> {score}
          </span>
        )}
        <span className="mpop-edge" aria-hidden="true" />
        <span className="mpop-corner" aria-hidden="true" />
      </div>
      <div className="mpop-meta">
        <p className="mpop-name">{title}</p>
        <div className="mpop-sub">
          {item.episodes ? <span>{item.episodes} ep</span> : null}
          {item.episodes && format ? <span className="mpop-dot" aria-hidden="true" /> : null}
          {format ? <span>{format}</span> : null}
        </div>
      </div>
    </Link>
  );
}
