"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import type { DoujinshiEntry } from "@/lib/mangadex-api";
import { logError } from "@/lib/logger";
import RevealTitle from "@/components/RevealTitle";

interface Props {
  entry: DoujinshiEntry;
}

const STATUS_OPTIONS = [
  { value: "want", label: "Want to Read", color: "var(--color-cyan)" },
  { value: "reading", label: "Reading", color: "var(--color-violet)" },
  { value: "read", label: "Read", color: "var(--color-magenta)" },
  { value: "favorite", label: "Favorite", color: "var(--color-amber)" },
];

// MangaDex sometimes returns creator names only in Japanese script. Show the
// standard English romanization while keeping the source value as a tooltip.
const NAME_ROMANIZATIONS: Record<string, string> = {
  "三澄ツバキ": "Mitsumi Tsubaki",
};

function displayName(value: string) {
  return NAME_ROMANIZATIONS[value] ?? value;
}

export default function DoujinshiDetail({ entry }: Props) {
  const { data: session } = useSession();
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === trackStatus);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/doujinshi/my`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.entries?.find(
          (e: { doujinshi: { id: string }; entry: { status: string } }) =>
            e.doujinshi.id === entry.id,
        );
        if (found) setTrackStatus(found.entry.status);
      })
      .catch(() => {});
  }, [session, entry.id]);

  async function handleTrack(status: string) {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/doujinshi/${entry.id}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setTrackStatus(status);
    } catch (e) { logError(e); }
  }

  async function handleRemoveTracking() {
    try {
      const res = await fetch(`/api/doujinshi/${entry.id}/track`, {
        method: "DELETE",
      });
      if (res.ok) setTrackStatus(null);
    } catch (e) { logError(e); }
  }

  return (
    <div className="djdet-page">
      {/* ═══════════════ HERO ═══════════════ */}
      <div className="djdet-hero">
        <span className="djdet-hero-grid" aria-hidden="true" />
        <span className="djdet-orb djdet-orb-a" aria-hidden="true" />
        <span className="djdet-orb djdet-orb-b" aria-hidden="true" />
        <span className="djdet-orb djdet-orb-c" aria-hidden="true" />
        <span className="djdet-hero-scan" aria-hidden="true" />

        <div className="djdet-hero-inner">
          <Link href="/doujinshi" className="djdet-back">
            <span className="djdet-back-chip" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="djdet-back-arrow">
                <path d="M19 12H5m7-7l-7 7 7 7" />
              </svg>
            </span>
            <span>Back to Doujinshi</span>
          </Link>

          <div className="djdet-hero-layout">
            {/* Cover */}
            <div className="djdet-cover-wrap">
              <span className="djdet-cover-glow" aria-hidden="true" />
              <div className="djdet-cover-frame">
                {entry.image && !imageFailed ? (
                  <Image
                    src={entry.image}
                    alt={entry.title}
                    fill
                    className="djdet-cover-img"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="djdet-cover-fallback">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z" />
                    </svg>
                    <span>Doujinshi</span>
                  </div>
                )}
                <span className="djdet-cover-shade" aria-hidden="true" />
                <span className="djdet-cover-line" aria-hidden="true" />
              </div>
            </div>

            {/* Info */}
            <div className="djdet-hero-copy">
              <div className="djdet-kicker">
                <span className="djdet-kicker-dot" aria-hidden="true" />
                Doujinshi
                <span className="djdet-kicker-rule" aria-hidden="true" />
              </div>

              <div className="djdet-title-frame">
                <RevealTitle as="h1" text={entry.title} className="djdet-title" />
                <span className="djdet-title-rule" aria-hidden="true" />
              </div>

              <div className="djdet-facts">
                {entry.circle && (
                  <div className="djdet-fact">
                    <span className="djdet-fact-label">Circle</span>
                    <span
                      className="djdet-fact-value"
                      title={entry.circle !== displayName(entry.circle) ? entry.circle : undefined}
                    >
                      {displayName(entry.circle)}
                    </span>
                  </div>
                )}
                {entry.artist && (
                  <div className="djdet-fact">
                    <span className="djdet-fact-label">Artist</span>
                    <span
                      className="djdet-fact-value"
                      title={entry.artist !== displayName(entry.artist) ? entry.artist : undefined}
                    >
                      {displayName(entry.artist)}
                    </span>
                  </div>
                )}
                {entry.parody && entry.parody !== "Original" && entry.parody !== "Various" && (
                  <div className="djdet-fact">
                    <span className="djdet-fact-label">Parody</span>
                    <span className="djdet-fact-value">{entry.parody}</span>
                  </div>
                )}
                {entry.pages > 0 && (
                  <div className="djdet-fact">
                    <span className="djdet-fact-label">Pages</span>
                    <span className="djdet-fact-value">{entry.pages}</span>
                  </div>
                )}
                <div className="djdet-fact">
                  <span className="djdet-fact-label">Language</span>
                  <span className="djdet-fact-value djdet-upper">{entry.language}</span>
                </div>
              </div>

              {/* Badges */}
              <div className="djdet-badges">
                <span className="djdet-badge djdet-badge-lang">{entry.language.toUpperCase()}</span>
                {entry.isTranslated && (
                  <span className="djdet-badge djdet-badge-translated">Translated</span>
                )}
              </div>

              {/* Tags */}
              <div className="djdet-tags">
                {entry.tags.slice(0, 12).map((tag, index) => (
                  <Link
                    key={tag}
                    href={`/doujinshi?tag=${tag}`}
                    className="djdet-tag djdet-tag-hero"
                    style={{ animationDelay: `${120 + index * 60}ms` }}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>

              {/* CTA */}
              <div className="djdet-actions">
                <a
                  href={entry.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="djdet-read-primary"
                >
                  <span className="djdet-read-shine" aria-hidden="true" />
                  <span>Read Online ↗</span>
                </a>
                {session && trackStatus && (
                  <span
                    className="djdet-status-pill"
                    style={{ backgroundColor: currentStatus?.color || "var(--color-mute)" }}
                  >
                    {currentStatus?.label || trackStatus}
                  </span>
                )}
              </div>
              <span className="djdet-hero-rule" aria-hidden="true" />
            </div>
          </div>
        </div>
        <span className="djdet-hero-edge" aria-hidden="true" />
      </div>

      {/* ═══════════════ MAIN ═══════════════ */}
      <div className="djdet-main">
        <div className="djdet-content">
          {/* Story */}
          <section className="djdet-panel djdet-story">
            <span className="djdet-story-aura" aria-hidden="true" />
            <SectionTitle>Story</SectionTitle>
            <div className="djdet-story-body">
              <span className="djdet-story-quote" aria-hidden="true">
                “
              </span>
              {entry.description ? (
                <p className="djdet-description">{entry.description}</p>
              ) : (
                <p className="djdet-empty">No description available.</p>
              )}
            </div>
            <div className="djdet-story-footer" aria-hidden="true">
              <span className="djdet-story-line" />
              <span className="djdet-story-node" />
            </div>
            <span className="djdet-panel-accent" aria-hidden="true" />
          </section>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <section className="djdet-panel djdet-tags-panel">
              <span className="djdet-tagpanel-aura" aria-hidden="true" />
              <SectionTitle>Tags</SectionTitle>
              <div className="djdet-tag-list">
                {entry.tags.map((tag, index) => (
                  <Link
                    key={tag}
                    href={`/doujinshi?tag=${tag}`}
                    className="djdet-tag djdet-tag-list-item"
                    style={{ animationDelay: `${80 + index * 70}ms` }}
                  >
                    <span className="djdet-tag-hash" aria-hidden="true">
                      #
                    </span>
                    <span className="djdet-tag-label">{tag}</span>
                    <span className="djdet-tag-dot" aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <span className="djdet-panel-accent" aria-hidden="true" />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="djdet-sidebar">
          {/* Tracking */}
          {session && (
            <section className="djdet-panel djdet-side-panel">
              <h3 className="djdet-side-title">Tracking</h3>
              {trackStatus ? (
                <div className="djdet-track-active">
                  <span
                    className="djdet-status-pill"
                    style={{ backgroundColor: currentStatus?.color || "var(--color-mute)" }}
                  >
                    {currentStatus?.label || trackStatus}
                  </span>
                  <div className="djdet-track-options">
                    {STATUS_OPTIONS.filter((s) => s.value !== trackStatus).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleTrack(opt.value)}
                        className="djdet-track-btn"
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      onClick={handleRemoveTracking}
                      className="djdet-track-remove"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="djdet-track-options">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleTrack(opt.value)}
                      className="djdet-track-btn"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <span className="djdet-panel-accent" aria-hidden="true" />
            </section>
          )}

          {/* Read */}
          <section className="djdet-panel djdet-side-panel djdet-read-panel">
            <span className="djdet-read-glow" aria-hidden="true" />
            <h3 className="djdet-side-title">Read</h3>
            <a
              href={entry.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="djdet-read-link"
            >
              <span className="djdet-read-icon-wrap" aria-hidden="true">
                <span className="djdet-read-icon">📖</span>
                <span className="djdet-read-icon-ring" />
              </span>
              <span className="djdet-read-label">Read Online on MangaDex</span>
              <span className="djdet-read-arrow">↗</span>
            </a>
            <span className="djdet-read-scan" aria-hidden="true" />
            <span className="djdet-panel-accent" aria-hidden="true" />
          </section>

          {/* Info */}
          <section className="djdet-panel djdet-side-panel djdet-details-panel">
            <span className="djdet-details-glow" aria-hidden="true" />
            <h3 className="djdet-side-title">Details</h3>
            <dl className="djdet-details">
              {entry.circle && (
                <div className="djdet-detail-row">
                  <dt>Circle</dt>
                  <dd
                    className="djdet-detail-value"
                    title={entry.circle !== displayName(entry.circle) ? entry.circle : undefined}
                  >
                    {displayName(entry.circle)}
                  </dd>
                </div>
              )}
              {entry.artist && (
                <div className="djdet-detail-row">
                  <dt>Artist</dt>
                  <dd
                    className="djdet-detail-value"
                    title={entry.artist !== displayName(entry.artist) ? entry.artist : undefined}
                  >
                    {displayName(entry.artist)}
                  </dd>
                </div>
              )}
              {entry.parody && entry.parody !== "Original" && entry.parody !== "Various" && (
                <div className="djdet-detail-row">
                  <dt>Parody</dt>
                  <dd className="djdet-detail-value">{entry.parody}</dd>
                </div>
              )}
              {entry.pages > 0 && (
                <div className="djdet-detail-row">
                  <dt>Pages</dt>
                  <dd className="djdet-detail-value">{entry.pages}</dd>
                </div>
              )}
              <div className="djdet-detail-row">
                <dt>Language</dt>
                <dd className="djdet-detail-value djdet-upper">{entry.language}</dd>
              </div>
              <div className="djdet-detail-row">
                <dt>Translation</dt>
                <dd className="djdet-detail-value">{entry.isTranslated ? "English" : "Not available"}</dd>
              </div>
              <div className="djdet-detail-row">
                <dt>Tags</dt>
                <dd className="djdet-detail-value">{entry.tags.length}</dd>
              </div>
            </dl>
            <span className="djdet-panel-accent" aria-hidden="true" />
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="djdet-section-title">
      <span className="djdet-section-bar" aria-hidden="true" />
      <RevealTitle as="span">{children}</RevealTitle>
      <span className="djdet-section-line" aria-hidden="true" />
    </h2>
  );
}
