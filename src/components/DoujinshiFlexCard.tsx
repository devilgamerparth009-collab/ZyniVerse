"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { DoujinshiEntry } from "@/lib/mangadex-api";

function CoverFallback({ item }: { item: DoujinshiEntry }) {
  return (
    <div className="djflex-fallback">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="djflex-fallback-icon">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z" />
      </svg>
      <p className="djflex-fallback-title">{item.title}</p>
      {item.circle ? <p className="djflex-fallback-circle">{item.circle}</p> : null}
    </div>
  );
}

function CardCover({ item, mobile = false }: { item: DoujinshiEntry; mobile?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) return <CoverFallback item={item} />;
  return (
    <Image
      src={item.image}
      alt={item.title}
      fill
      className={mobile ? "djflex-img djflex-img-mobile" : "djflex-img"}
      sizes={mobile ? "140px" : "(max-width: 768px) 50vw, 25vw"}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function DoujinshiFlexCard({ items }: { items: DoujinshiEntry[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="djflex-mobile-rail">
        {items.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            href={`/doujinshi/${item.id}`}
            className="djflex-m-card group"
          >
            <div className="djflex-m-cover">
              <CardCover item={item} mobile />
              <span className="djflex-m-shade" aria-hidden="true" />
            </div>
            <div className="djflex-m-info">
              <p className="djflex-m-title">{item.title}</p>
              <div className="djflex-m-meta">
                {item.circle && <span>{item.circle}</span>}
                {item.pages ? <span>{item.pages} pg</span> : null}
              </div>
            </div>
            <div className="djflex-num-wrap">
              <span className="djflex-num">
                {(items.indexOf(item) + 1).toString().padStart(2, "0")}
              </span>
            </div>
            <span className="djflex-card-line" aria-hidden="true" />
          </Link>
        ))}
      </div>

      {/* Desktop: expanding flex card */}
      <div className="djflex-stage">
        {items.slice(0, 8).map((item) => {
          const isHovered = hovered === item.id;

          return (
            <div
              key={item.id}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              className="djflex-item group"
              data-hover={isHovered ? "true" : "false"}
              style={{ flex: isHovered ? 3 : 1, minWidth: 0 }}
            >
              <Link href={`/doujinshi/${item.id}`} className="djflex-item-link">
                <div className="djflex-cover">
                  <CardCover item={item} />
                </div>
                <span className="djflex-shade" aria-hidden="true" />
                <span className="djflex-side-shade" aria-hidden="true" />
                <span className="djflex-card-line" aria-hidden="true" />

                <p className="djflex-vertical-title">{item.title}</p>

                <div className="djflex-detail">
                  <p className="djflex-detail-title">{item.title}</p>

                  <div className="djflex-meta">
                    {item.circle && <span className="djflex-meta-circle">{item.circle}</span>}
                    {item.artist && <span>{item.artist}</span>}
                    {item.pages ? <span>{item.pages} pages</span> : null}
                  </div>

                  <div className="djflex-badges">
                    {item.parody && item.parody !== "Original" && (
                      <span className="djflex-badge djflex-badge-parody">{item.parody}</span>
                    )}
                    <span className="djflex-badge djflex-badge-lang">{item.language}</span>
                    {item.isTranslated && (
                      <span className="djflex-badge djflex-badge-translated">Translated</span>
                    )}
                  </div>

                  <div className="djflex-tags">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="djflex-tag">#{tag}</span>
                    ))}
                  </div>

                  <span className="djflex-cta">
                    <span>View Details →</span>
                  </span>
                </div>

                <div className="djflex-num-wrap">
                  <span className="djflex-num">
                    {(items.indexOf(item) + 1).toString().padStart(2, "0")}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
