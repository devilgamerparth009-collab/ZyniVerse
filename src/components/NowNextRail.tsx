"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { TV_CHANNELS, formatIstTime, getDayName, getIstMinutes } from "@/lib/tv-channels";
import { computeNowNext, timeToMinutes } from "@/lib/tv-now-next";

interface RailSlot {
  show: string;
  start: string;
  end: string;
  duration: number;
  description?: string;
  episode?: number;
  coverImage?: string;
  isLive?: boolean;
}

interface RailChannel {
  channelId: string;
  channelName: string;
  channelColor: string;
  channelLogo?: string;
  channelType: "tv" | "youtube";
  days: Record<string, RailSlot[]>;
}

export interface RailData {
  updatedAt: string;
  today: string;
  channels: RailChannel[];
  liveAiringTotal: number;
}

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "right now";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function ChannelLogo({ channelId, size = 36 }: { channelId: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const ch = TV_CHANNELS[channelId];
  if (!ch) return null;
  const logoSrc = ch.logoProxyUrl || ch.logoUrl;
  if (!logoSrc || imgError) {
    return (
      <span
        className="tvsch-rail-logo flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${ch.color}, ${ch.color}bb)`,
          fontSize: size > 40 ? 11 : 9,
        }}
      >
        {ch.shortName}
      </span>
    );
  }
  return (
    <Image
      src={logoSrc}
      alt={ch.name}
      width={size}
      height={size}
      className="tvsch-rail-logo shrink-0 rounded-lg"
      style={{ objectFit: "contain", width: size, height: size, background: ch.logoPlate === "dark" ? "#0d0d16" : "#f6f7fb", border: `1px solid ${ch.color}44`, padding: 2 }}
      onError={() => setImgError(true)}
    />
  );
}

function RailRow({
  channel,
  today,
  nowMinutes,
  index,
}: {
  channel: RailChannel;
  today: string;
  nowMinutes: number;
  index: number;
}) {
  // `days` — the real array ref or undefined — is the memo dependency, never a
  // fresh fallback: `days || []` inside the memo keeps the dep stable when the
  // schedule has no entry for today (react-hooks/exhaustive-deps).
  const days = channel.days?.[today];
  const result = useMemo(() => computeNowNext(days ?? [], nowMinutes), [days, nowMinutes]);
  const ch = TV_CHANNELS[channel.channelId];
  if (!ch) return null;

  const now = result.now;
  const next = result.next;
  if (!now && !next) return null;

  const isAlways = now && now.start === "00:00" && now.end === "00:00";

  let elapsedPct = 0;
  if (now && !isAlways) {
    const start = timeToMinutes(now.start);
    const end = timeToMinutes(now.end);
    const duration = start > end ? 1440 - start + end : end - start;
    const elapsed = start > end
      ? (nowMinutes >= start ? nowMinutes - start : 1440 - start + nowMinutes)
      : Math.min(Math.max(nowMinutes - start, 0), duration);
    elapsedPct = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;
  }

  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(`channel-${channel.channelId}`);
        el?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      }}
      className="tvsch-rail-card"
      style={
        {
          "--tvsch-accent": channel.channelColor,
          "--tvsch-i": Math.min(index, 11),
        } as React.CSSProperties
      }
    >
      <div className="tvsch-rail-card-head">
        <ChannelLogo channelId={channel.channelId} />
        <div className="min-w-0">
          <p className="tvsch-rail-channel">{channel.channelName}</p>
          <p className="tvsch-rail-kind">
            {channel.channelType === "tv" ? "TV" : "Streaming"}
          </p>
        </div>
        {now && (
          <span className="tvsch-rail-live">
            <span className="tvsch-live-dot" aria-hidden="true" />
            Live
          </span>
        )}
      </div>

      <div className="tvsch-rail-lines">
        <div className="tvsch-rail-line tvsch-rail-line--now">
          <span className="tvsch-rail-tag tvsch-rail-tag--now">Now</span>
          <div className="min-w-0 flex-1">
            <p className="tvsch-rail-show">{now ? now.show : "—"}</p>
            {now && !isAlways && (
              <div className="tvsch-rail-progress">
                <div
                  style={{
                    width: `${elapsedPct}%`,
                    background: channel.channelColor,
                    boxShadow: `0 0 8px ${channel.channelColor}55`,
                  }}
                />
              </div>
            )}
          </div>
          {now && !isAlways && (
            <span className="tvsch-rail-time">
              {now.start}–{now.end}
              {result.nowEndsInMinutes != null && (
                <span className="ml-1 text-[var(--color-cyan)]/70">
                  · {formatCountdown(result.nowEndsInMinutes)} left
                </span>
              )}
            </span>
          )}
          {isAlways && <span className="tvsch-rail-247">24/7</span>}
        </div>

        <div className="tvsch-rail-line tvsch-rail-line--next">
          <span className="tvsch-rail-tag">Next</span>
          <p className="tvsch-rail-next-show">
            {next ? next.show : "No more shows today"}
          </p>
          {next && (
            <span className="tvsch-rail-next-time">
              <span className="text-[var(--color-magenta)]">
                {result.nextInMinutes != null && result.nextInMinutes < 360 ? `in ${formatCountdown(result.nextInMinutes)}` : "kal"}
              </span>
              <span className="ml-1 text-[var(--color-mute)]">{formatTime(next.start)}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function NowNextRail({ data }: { data: RailData | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const nowMinutes = getIstMinutes(now);
  const today = data?.today || getDayName(now);

  const rows = useMemo(() => {
    if (!data) return [];
    return [...data.channels]
      .filter((ch) => Boolean(ch.days?.[today]?.length))
      .sort((a, b) => {
        const aNow = computeNowNext(a.days?.[today] || [], nowMinutes).now ? 1 : 0;
        const bNow = computeNowNext(b.days?.[today] || [], nowMinutes).now ? 1 : 0;
        if (aNow !== bNow) return bNow - aNow;
        if (a.channelType !== b.channelType) return a.channelType === "tv" ? -1 : 1;
        return a.channelName.localeCompare(b.channelName);
      });
  }, [data, today, nowMinutes]);

  const railState = rows.reduce(
    (acc, ch) => {
      const result = computeNowNext(ch.days?.[today] || [], nowMinutes);
      if (result.now) acc.live += 1;
      if (result.next) acc.next += 1;
      return acc;
    },
    { live: 0, next: 0 }
  );

  if (!data || rows.length === 0) {
    return (
      <div className="tvsch-rail-loading">
        Loading the live guide — now and next will appear shortly…
      </div>
    );
  }

  const timeStr = formatIstTime(now);

  return (
    <section className="tvsch-rail relative mb-8">
      <span className="tvsch-rail-scan" aria-hidden="true" />

      <div className="relative p-4 sm:p-5">
        <div className="tvsch-rail-head">
          <div className="flex items-center gap-3">
            <span className="tvsch-rail-head-dot" aria-hidden="true" />
            <div>
              <h2 className="tvsch-rail-title">Now playing · Up next</h2>
              <p className="tvsch-rail-subtitle">
                India TV + streaming · countdown har 30s refresh
              </p>
            </div>
          </div>
          <div className="tvsch-rail-head-meta">
            <span className="tvsch-rail-counter tvsch-rail-counter--live">
              {railState.live} Live
            </span>
            <span className="tvsch-rail-counter">{railState.next} Next</span>
            <span className="tvsch-rail-clock">🕐 {timeStr} IST</span>
          </div>
        </div>

        <div className="tvsch-rail-grid">
          {rows.map((ch, i) => (
            <RailRow key={ch.channelId} channel={ch} today={today} nowMinutes={nowMinutes} index={i} />
          ))}
        </div>

        <p className="tvsch-rail-foot">
          Select a row to open the channel&apos;s full schedule · updated {formatIstTime(data.updatedAt)} IST
        </p>
      </div>
    </section>
  );
}