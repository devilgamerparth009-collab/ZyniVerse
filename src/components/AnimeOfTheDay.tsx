"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { bestTitle, type Media } from "@/lib/anilist";

interface AOTD {
  day: string;
  anime: {
    id: number;
    title: string;
    image: string;
    format?: string;
    episodes?: number;
    genres?: string[];
    score?: number;
    status?: string;
  };
  why: string;
}

function compactCount(value?: number): string {
  if (!value) return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export default function AnimeOfTheDay({ companions = [] }: { companions?: Media[] }) {
  const [data, setData] = useState<AOTD | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/anime-of-the-day")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: AOTD) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return null;
  if (!data) return null;

  const { anime } = data;
  const companion =
    companions.find((item) => item.id !== anime.id) ?? companions[0] ?? null;

  return (
    <section
      className={`aotd-card group${companion ? "" : " aotd-card--solo"}`}
      aria-label="Anime of the Day and trending pick"
    >
      <Link href={`/anime/${anime.id}`} className="aotd-half aotd-half--pick">
        <div className="aotd-poster">
          {anime.image ? (
            <Image
              src={anime.image}
              alt={anime.title}
              fill
              className="aotd-img"
              sizes="(max-width: 767px) 100vw, (max-width: 1024px) 104px, 124px"
              loading="eager"
              priority
            />
          ) : null}
          <span className="aotd-sheen" aria-hidden="true" />
          <span className="aotd-day">
            <span className="aotd-day-dot" aria-hidden="true" />
            Anime of the Day
          </span>
        </div>

        <div className="aotd-body">
          <div className="aotd-eyebrow-row">
            <span className="aotd-eyebrow">Today&apos;s pick</span>
            <span className="aotd-daily">Fresh daily</span>
          </div>
          <h2 className="aotd-title">{anime.title}</h2>
          <p className="aotd-why">{data.why}</p>
          <div className="aotd-stats">
            {anime.format ? (
              <span className="aotd-stat">
                <strong>{anime.format}</strong>
              </span>
            ) : null}
            {!!anime.episodes ? (
              <span className="aotd-stat">
                <strong>{anime.episodes}</strong> eps
              </span>
            ) : null}
            {!!anime.score ? (
              <span className="aotd-score">
                <span aria-hidden="true">★</span> {anime.score}%
              </span>
            ) : null}
          </div>
          {anime.genres?.length ? (
            <div className="aotd-chips">
              {anime.genres.slice(0, 3).map((genre) => (
                <span key={genre} className="aotd-chip">
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
          <span className="aotd-cta">
            Explore <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>

      {companion ? (
        <Link href={`/anime/${companion.id}`} className="aotd-half aotd-half--trending">
          <div className="aotd-poster">
            {companion.coverImage?.extraLarge ||
            companion.coverImage?.large ||
            companion.coverImage?.medium ? (
              <Image
                src={
                  companion.coverImage.extraLarge ||
                  companion.coverImage.large ||
                  companion.coverImage.medium ||
                  ""
                }
                alt={bestTitle(companion.title)}
                fill
                className="aotd-img"
                sizes="(max-width: 767px) 100vw, (max-width: 1024px) 104px, 124px"
              />
            ) : null}
            <span className="aotd-sheen" aria-hidden="true" />
            <span className="aotd-day aotd-day--cyan">
              <span className="aotd-day-dot" aria-hidden="true" />
              Trending now
            </span>
          </div>

          <div className="aotd-body">
            <div className="aotd-eyebrow-row">
              <span className="aotd-eyebrow aotd-eyebrow--cyan">Also popular</span>
              <span className="aotd-daily">
                {compactCount(companion.popularity)} fans
              </span>
            </div>
            <h2 className="aotd-title">{bestTitle(companion.title)}</h2>
            <p className="aotd-why">
              Trending alongside today&apos;s pick — another anime the community is watching right now.
            </p>
            <div className="aotd-stats">
              {companion.format ? (
                <span className="aotd-stat">
                  <strong>{companion.format}</strong>
                </span>
              ) : null}
              {!!companion.episodes ? (
                <span className="aotd-stat">
                  <strong>{companion.episodes}</strong> eps
                </span>
              ) : null}
              {!!companion.averageScore ? (
                <span className="aotd-score">
                  <span aria-hidden="true">★</span> {companion.averageScore}%
                </span>
              ) : null}
            </div>
            {companion.genres?.length ? (
              <div className="aotd-chips">
                {companion.genres.slice(0, 3).map((genre) => (
                  <span key={genre} className="aotd-chip">
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}
            <span className="aotd-cta">
              Explore <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      ) : null}
    </section>
  );
}
