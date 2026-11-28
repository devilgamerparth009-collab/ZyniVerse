"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  TV_CHANNELS,
  getScheduleForChannel,
  getDayName,
  getIstMinutes,
  getNext7Days,
  formatIstTime,
  type TimeSlot,
  type TvChannel,
} from "@/lib/tv-channels";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NowNextRail from "@/components/NowNextRail";

interface LiveAiringEntry {
  id: number;
  title: string;
  englishTitle?: string;
  episode: number;
  airTime: string;
  day: string;
  coverImage?: string;
  genres?: string[];
  format?: string;
  totalEpisodes?: number;
}

interface LiveAiringData {
  updatedAt: string;
  days: Record<string, LiveAiringEntry[]>;
  total: number;
}

interface LiveScheduleEntry {
  show: string;
  start: string;
  end: string;
  duration: number;
  description?: string;
  episode?: number;
  coverImage?: string;
  isLive?: boolean;
}

interface ChannelLiveSchedule {
  channelId: string;
  channelName: string;
  channelColor: string;
  channelLogo?: string;
  channelType: "tv" | "youtube";
  days: Record<string, LiveScheduleEntry[]>;
  source?: "epg" | "fallback" | "live" | "empty";
}

interface LiveScheduleData {
  updatedAt: string;
  today: string;
  channels: ChannelLiveSchedule[];
  liveAiringTotal: number;
  offlineLinear?: boolean;
}
import { PageTransition } from "@/components/PageTransition";
import { logError } from "@/lib/logger";

function useReveal(delay = 0) {
  const reduce = useReducedMotion() ?? false;
  return {
    initial: reduce ? false : { opacity: 0, y: 16 },
    whileInView: reduce ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: reduce ? 0 : 0.45, delay: reduce ? 0 : delay },
  };
}

function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function NeonBorder({ children, glowColor }: { children: React.ReactNode; glowColor?: string }) {
  return (
    <div
      className="tvsch-neon"
      style={{ "--tvsch-neon": glowColor || "#29f2e0" } as React.CSSProperties}
    >
      <div className="tvsch-neon-ring" aria-hidden="true" />
      <div className="tvsch-neon-shards" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="tvsch-neon-face">{children}</div>
    </div>
  );
}

function ChannelLogo({
  channel,
  size = 48,
}: {
  channel: TvChannel;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  // Prefer the same-origin proxy: Wikimedia rate-limits direct image loads.
  const logoSrc = channel.logoProxyUrl || channel.logoUrl;
  const showImg = logoSrc && !imgError;

  if (!showImg) {
    return (
      <div
        className="tvsch-logo-fallback flex items-center justify-center rounded-xl text-xs font-bold text-white shrink-0 shadow-lg"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${channel.color}, ${channel.color}cc)`,
          border: `1.5px solid ${channel.color}44`,
          fontSize: size > 40 ? 12 : 9,
        }}
      >
        {channel.shortName}
      </div>
    );
  }

  return (
    <Image
      src={channel.logoProxyUrl || channel.logoUrl || ""}
      alt={channel.name}
      width={size}
      height={size}
      className="tvsch-logo rounded-xl shrink-0 shadow-lg"
      style={{ border: `1.5px solid ${channel.color}44`, objectFit: "contain", background: channel.logoPlate === "dark" ? "#0d0d16" : "#f6f7fb", width: size, height: size, padding: 2 }}
      onError={() => setImgError(true)}
    />
  );
}

const TV_CHANNEL_IDS = [
  "cn",
  "sony_yay",
  "hungama",
  "super_hungama",
  "pogo",
  "nick",
  "nick_jr",
  "sonic",
  "discovery_kids",
  "disney_channel",
  "disney_junior",
  "epic_kids",
  "animax",
];
const YT_CHANNEL_IDS = ["muse_asia", "muse_india", "crunchyroll", "netflix_anime", "prime_video", "sony_liv", "jio_hotstar"];

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isCurrentlyAiring(slot: TimeSlot): boolean {
  const cur = getIstMinutes();
  const start = parseMinutes(slot.start);
  const end = parseMinutes(slot.end);
  if (start > end) {
    return cur >= start || cur < end;
  }
  return cur >= start && cur < end;
}

function isPast(slot: TimeSlot): boolean {
  const cur = getIstMinutes();
  const start = parseMinutes(slot.start);
  const end = parseMinutes(slot.end);
  if (start > end) {
    return cur >= end && cur < start;
  }
  return cur >= end && end !== 0;
}

function LiveAiringSection({ selectedDay }: { selectedDay: string }) {
  const [data, setData] = useState<LiveAiringData | null>(null);
  const [loading, setLoading] = useState(true);
  const reveal = useReveal(0.08);

  useEffect(() => {
    let cancelled = false;
    async function fetchLive() {
      try {
        const res = await fetch("/api/airing/live");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) { logError(e); }
      if (!cancelled) setLoading(false);
    }
    fetchLive();
    const interval = setInterval(fetchLive, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading || !data) {
    return (
      <motion.div {...reveal} className="tvsch-airing mb-6">
        <NeonBorder glowColor="#e879f9">
          <div className="tvsch-airing-body">
            <div className="flex items-center gap-3">
              <span className="tvsch-airing-dot" aria-hidden="true" />
              <span className="tvsch-eq" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <div>
                <p className="tvsch-airing-title">Live airing wave</p>
                <p className="text-[10px] text-[var(--color-mute)]">
                  Fetching this week&apos;s Japanese broadcast data...
                </p>
              </div>
            </div>
          </div>
        </NeonBorder>
      </motion.div>
    );
  }

  const daySchedule = data.days[selectedDay] || [];
  if (daySchedule.length === 0) return null;

  return (
    <motion.div {...reveal} className="tvsch-airing mb-6">
      <NeonBorder glowColor="#e879f9">
        <div className="tvsch-airing-body">
          <div className="tvsch-airing-scan" aria-hidden="true" />
          <div className="relative">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="tvsch-airing-dot" aria-hidden="true" />
                <span className="tvsch-eq" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <div>
                  <h3 className="tvsch-airing-title">Live airing wave</h3>
                  <p className="text-[10px] text-[var(--color-mute)]">
                    {daySchedule.length} anime airing this week · {selectedDay} line-up
                  </p>
                </div>
              </div>
              <span className="tvsch-airing-updated">
                Updated {formatIstTime(data.updatedAt)} IST
              </span>
            </div>

            <div className="tvsch-airing-note">
              <span className="font-bold text-[var(--color-magenta)]">Japan broadcast times in IST.</span>{" "}
              Streaming platforms may air episodes a few hours later. The channel grid below is separate.
            </div>

            <div className="tvsch-airing-grid">
              {daySchedule.map((entry, i) => {
                const poster = entry.coverImage;
                const title = entry.englishTitle || entry.title;
                return (
                  <div
                    key={`${entry.id}-${entry.episode}`}
                    className="tvsch-airing-card"
                    style={{ "--tvsch-i": Math.min(i, 10) } as React.CSSProperties}
                  >
                    {poster ? (
                      <Image
                        src={poster}
                        alt={title}
                        width={40}
                        height={40}
                        className="tvsch-airing-poster"
                        style={{ width: 40, height: 40 }}
                      />
                    ) : (
                      <div className="tvsch-airing-poster tvsch-airing-poster--empty">
                        <span>EP</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-[var(--color-ink)]">
                        {title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold text-[var(--color-magenta)]">
                          {entry.airTime} IST
                        </span>
                        <span className="text-[9px] text-[var(--color-mute)]">
                          Ep {entry.episode}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </NeonBorder>
    </motion.div>
  );
}

function TimeSlotRow({
  slot,
  channelColor,
  showDescription,
  isStreaming,
  channelLogoUrl,
  channelShortName,
}: {
  slot: TimeSlot;
  channelColor: string;
  showDescription: boolean;
  isStreaming?: boolean;
  channelLogoUrl?: string;
  channelShortName?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const isAlwaysAvailable = isStreaming && slot.start === "00:00" && slot.end === "00:00";
  const airing = !isAlwaysAvailable && isCurrentlyAiring(slot);
  const past = !isAlwaysAvailable && isPast(slot);
  const showLogo = !!channelLogoUrl && !logoFailed;

  return (
    <div
      id={`slot-${slot.start.replace(":", "-")}`}
      data-live={airing ? "true" : undefined}
      data-past={past ? "true" : undefined}
      className="tvsch-slot"
    >
      <div className="tvsch-slot-time">
        {isAlwaysAvailable ? (
          <>
            <p className="text-[10px] font-bold text-emerald-400">24/7</p>
            <p className="font-mono text-[9px] text-[var(--color-mute)]">Always</p>
          </>
        ) : (
          <>
            <p className={`font-mono text-xs font-bold ${past ? "text-[var(--color-mute)] line-through" : "text-[var(--color-ink)]"}`}>
              {slot.start}
            </p>
            <p className="font-mono text-[9px] text-[var(--color-mute)]">
              {slot.end}
            </p>
          </>
        )}
      </div>

      <div
        className="tvsch-slot-accent"
        style={{
          background: airing
            ? `linear-gradient(to bottom, ${channelColor}, ${channelColor}66)`
            : isAlwaysAvailable
            ? `linear-gradient(to bottom, ${channelColor}66, ${channelColor}22)`
            : past
            ? "var(--color-line)"
            : `${channelColor}33`,
          boxShadow: airing ? `0 0 10px ${channelColor}66` : "none",
        }}
      />

      <div className="tvsch-slot-main">
        <div className="tvsch-slot-head">
          {showLogo ? (
            <Image
              src={channelLogoUrl || ""}
              alt={slot.show}
              width={32}
              height={32}
              className="tvsch-slot-logo"
              style={{ objectFit: "contain", background: "rgba(0,0,0,0.3)", width: 32, height: 32 }}
              onError={() => setLogoFailed(true)}
            />
          ) : channelShortName ? (
            <div
              className="tvsch-slot-logo tvsch-slot-logo--text"
              style={{ background: `${channelColor}cc` }}
            >
              {channelShortName}
            </div>
          ) : null}
          <p className={`tvsch-slot-title ${airing ? "tvsch-slot-title--live" : past ? "tvsch-slot-title--past" : ""}`}>
            {slot.show}
          </p>
          {airing && (
            <span className="tvsch-live-badge">
              <span className="tvsch-live-dot" aria-hidden="true" />
              Live
            </span>
          )}
          {isAlwaysAvailable && (
            <span className="tvsch-free-badge">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              Free · 24/7
            </span>
          )}
        </div>
        {showDescription && slot.description && (
          <p className="mt-0.5 truncate text-[10px] text-[var(--color-mute)]">
            {slot.description}
          </p>
        )}
      </div>

      <span className="tvsch-slot-duration">
        {isAlwaysAvailable ? "∞" : slot.duration > 0 ? `${slot.duration}m` : "—"}
      </span>
    </div>
  );
}

function ChannelScheduleCard({
  channel,
  day,
  searchQuery,
  liveSchedule,
  index = 0,
}: {
  channel: TvChannel;
  day: string;
  searchQuery: string;
  liveSchedule?: ChannelLiveSchedule;
  index?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reveal = useReveal(0.04 + Math.min(index, 6) * 0.03);
  const schedule = getScheduleForChannel(channel.id, day);
  const liveDaySlots = liveSchedule?.days[day];

  // Merge: use live data if available, fall back to hardcoded
  const effectiveSlots = useMemo(() => {
    if (liveDaySlots && liveDaySlots.length > 0) {
      return liveDaySlots.map((ls) => ({
        show: ls.show,
        start: ls.start,
        end: ls.end,
        duration: ls.duration,
        description: ls.description,
      }));
    }
    return schedule?.slots || [];
  }, [liveDaySlots, schedule]);

  const filteredSlots = useMemo(() => searchQuery
    ? effectiveSlots.filter((s) =>
        s.show.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : effectiveSlots, [effectiveSlots, searchQuery]);

  // When today is empty, point users to the next day that has episodes
  const nextDayWithSlots = useMemo(() => {
    if (filteredSlots.length > 0) return null;
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const startIdx = order.indexOf(day);
    if (startIdx === -1) return null;
    for (let i = 1; i <= 6; i++) {
      const d = order[(startIdx + i) % 7];
      if ((liveSchedule?.days[d]?.length ?? 0) > 0) return d;
    }
    return null;
  }, [filteredSlots, liveSchedule, day]);

  // Auto-scroll to currently airing slot within card (no page scroll)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || filteredSlots.length === 0) return;
    const timer = setTimeout(() => {
      const curMin = getIstMinutes();
      let targetIdx = filteredSlots.findIndex((s) => {
        const [sh, sm] = s.start.split(":").map(Number);
        const [eh, em] = s.end.split(":").map(Number);
        return curMin >= sh * 60 + sm && curMin < eh * 60 + em;
      });
      if (targetIdx === -1) {
        targetIdx = filteredSlots.findIndex((s) => {
          const [sh, sm] = s.start.split(":").map(Number);
          return sh * 60 + sm > curMin;
        });
        if (targetIdx === -1) targetIdx = filteredSlots.length - 1;
      }
      const el = container.querySelector(`#slot-${filteredSlots[targetIdx].start.replace(":", "-")}`) as HTMLElement;
      if (el && el.offsetTop !== undefined) {
        container.scrollTo({ top: el.offsetTop - container.offsetTop - 40, behavior: scrollBehavior() });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filteredSlots, day]);

  const showDesc = channel.type === "tv";
  const uniqueShows = [...new Set(filteredSlots.map((s) => s.show))];
  const sourceLabel =
    liveSchedule?.source === "epg"
      ? "LIVE EPG"
      : liveSchedule?.source === "live"
      ? "ONLINE"
      : liveSchedule?.source === "empty"
      ? "WAITING"
      : "GUIDE";
  const liveCount = filteredSlots.filter((s) => {
    const alwaysAvailable = channel.type !== "tv" && s.start === "00:00" && s.end === "00:00";
    return !alwaysAvailable && isCurrentlyAiring(s);
  }).length;
  const cardStyle = {
    "--tvsch-accent": channel.color,
    "--tvsch-i": Math.min(index, 10),
  } as React.CSSProperties;

  return (
    <motion.div id={`channel-${channel.id}`} {...reveal}>
      <NeonBorder glowColor={channel.color}>
        <div className="tvsch-card" style={cardStyle}>
          <div className="tvsch-card-head">
            <ChannelLogo channel={channel} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="tvsch-card-title">{channel.name}</p>
                <span className="tvsch-source-pill">{sourceLabel}</span>
                {liveCount > 0 && (
                  <span className="tvsch-live-count">
                    <span className="tvsch-live-dot" aria-hidden="true" />
                    {liveCount} LIVE
                  </span>
                )}
              </div>
              {channel.dthNumbers && (
                <p className="mt-0.5 text-[9px] text-[var(--color-mute)]">
                  {channel.dthNumbers}
                </p>
              )}
              {channel.type === "youtube" && channel.subscriberCount && (
                <p className="mt-0.5 text-[9px] text-[var(--color-mute)]">
                  {channel.subscriberCount} subscribers
                </p>
              )}
            </div>
            <div className="tvsch-card-actions">
              <button
                type="button"
                onClick={() => {
                  const container = scrollRef.current;
                  if (!container) return;
                  const airing = container.querySelector('[data-live="true"]') as HTMLElement;
                  if (airing) container.scrollTo({ top: airing.offsetTop - container.offsetTop - 40, behavior: scrollBehavior() });
                }}
                className="tvsch-now-btn"
              >
                Now
              </button>
              <span className="tvsch-count-pill">{uniqueShows.length} shows</span>
              <span className="tvsch-count-pill tvsch-count-pill--mono">{filteredSlots.length} slots</span>
            </div>
          </div>

          <div ref={scrollRef} className="tvsch-slot-scroll">
            {filteredSlots.length === 0 ? (
              <div className="tvsch-empty">
                <span className="tvsch-empty-icon" aria-hidden="true">◷</span>
                <div>
                  <p className="text-xs font-medium text-[var(--color-mute)]">No schedule data available</p>
                  {nextDayWithSlots ? (
                    <p className="mt-1 text-[10px] font-semibold text-[var(--color-cyan)]">
                      Next new episodes: {nextDayWithSlots}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-[var(--color-mute)]/60">
                      Live guide pending — check back later
                    </p>
                  )}
                </div>
              </div>
            ) : (
              filteredSlots.map((slot, i) => (
                <TimeSlotRow
                  key={`${slot.start}-${slot.show}-${i}`}
                  slot={slot}
                  channelColor={channel.color}
                  showDescription={showDesc}
                  isStreaming={channel.type !== "tv"}
                  channelLogoUrl={channel.logoProxyUrl || channel.logoUrl}
                  channelShortName={channel.shortName}
                />
              ))
            )}
          </div>
        </div>
      </NeonBorder>
    </motion.div>
  );
}

function ChannelFilterTabs({
  selectedChannel,
  onSelect,
  counts,
  totalCount,
}: {
  selectedChannel: string | null;
  onSelect: (id: string | null) => void;
  counts: Record<string, number>;
  totalCount: number;
}) {
  const reveal = useReveal(0.12);
  const renderChip = (id: string | null, ch?: TvChannel, index = 0) => {
    const active = selectedChannel === id;
    const color = ch?.color || "var(--color-cyan)";
    const label = id === null ? "All channels" : ch?.name || id;
    const count = id === null ? totalCount : counts[id] || 0;

    return (
      <button
        key={id ?? "all"}
        type="button"
        data-active={active}
        onClick={() => onSelect(active && id !== null ? null : id)}
        className="tvsch-chip"
        style={{ "--tvsch-accent": color, "--tvsch-i": Math.min(index, 12) } as React.CSSProperties}
      >
        <span
          className={`tvsch-chip-mark ${id === null ? "tvsch-chip-mark--all" : ""}`}
          style={id === null ? undefined : { background: ch?.color }}
        >
          {id === null ? "ALL" : ch?.shortName}
        </span>
        <span className="truncate">{label}</span>
        <span className="tvsch-chip-count">{count}</span>
      </button>
    );
  };

  return (
    <motion.div {...reveal} className="tvsch-controls mb-6">
      <div className="tvsch-control-head">
        <span className="tvsch-control-index">01</span>
        <div>
          <p className="tvsch-stat-label">Channel filters</p>
          <p className="text-[10px] text-[var(--color-mute)]">
            Pick one source or browse the full grid
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="tvsch-group-label">
            <span>TV CHANNELS</span>
            <span>{TV_CHANNEL_IDS.length} sources</span>
          </div>
          <div className="tvsch-chip-row">
            {renderChip(null, undefined, 0)}
            {TV_CHANNEL_IDS.map((id, i) => {
              const ch = TV_CHANNELS[id];
              return ch ? renderChip(id, ch, i + 1) : null;
            })}
          </div>
        </div>
        <div>
          <div className="tvsch-group-label">
            <span>STREAMING PLATFORMS</span>
            <span>{YT_CHANNEL_IDS.length} sources</span>
          </div>
          <div className="tvsch-chip-row">
            {YT_CHANNEL_IDS.map((id, i) => {
              const ch = TV_CHANNELS[id];
              return ch ? renderChip(id, ch, i + 1) : null;
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TvSchedulePage() {
  const [selectedDay, setSelectedDay] = useState<string>(getDayName());
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveData, setLiveData] = useState<LiveScheduleData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroReveal = useReveal(0);
  const dayReveal = useReveal(0.08);
  const searchReveal = useReveal(0.1);
  const gridReveal = useReveal(0.16);

  const days = useMemo(() => getNext7Days(), []);
  const channels = useMemo(() => Object.values(TV_CHANNELS), []);

  // Fetch live schedule data
  const fetchLiveData = useCallback(async () => {
    try {
      const res = await fetch("/api/tv-schedule/live");
      if (!res.ok) return;
      const data: LiveScheduleData = await res.json();
      setLiveData(data);
      setLastUpdated(`${formatIstTime(data.updatedAt)} IST`);
    } catch (e) { logError(e); }
  }, []);

  // Initial fetch + auto-refresh every 30 minutes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLiveData();
    intervalRef.current = setInterval(fetchLiveData, 30 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLiveData]);

  const filteredChannels = useMemo(() => {
    if (selectedChannel) {
      return channels.filter((ch) => ch.id === selectedChannel);
    }
    return channels;
  }, [selectedChannel, channels]);

  const orderedChannels = useMemo(() => {
    const tv = filteredChannels.filter((ch) => ch.type === "tv");
    const yt = filteredChannels.filter((ch) => ch.type === "youtube");
    return [...tv, ...yt];
  }, [filteredChannels]);

  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
    liveData?.channels.forEach((lc) => {
      days.forEach((day) => {
        counts[day] += lc.days[day]?.length || 0;
      });
    });
    return counts;
  }, [days, liveData]);

  const selectedDayStats = useMemo(() => {
    const shows = new Set<string>();
    let slots = 0;
    let activeChannels = 0;
    liveData?.channels.forEach((lc) => {
      const entries = lc.days[selectedDay] || [];
      if (entries.length) activeChannels += 1;
      slots += entries.length;
      entries.forEach((entry) => shows.add(entry.show));
    });
    return { slots, shows: shows.size, channels: activeChannels };
  }, [liveData, selectedDay]);

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    liveData?.channels.forEach((lc) => {
      counts[lc.channelId] = lc.days[selectedDay]?.length || 0;
    });
    return counts;
  }, [liveData, selectedDay]);

  const feedSummary = useMemo(() => {
    let epg = 0;
    let online = 0;
    let guide = 0;
    liveData?.channels.forEach((channel) => {
      if (channel.source === "epg") epg += 1;
      else if (channel.source === "live") online += 1;
      else if (channel.source === "fallback") guide += 1;
    });
    return { epg, online, guide };
  }, [liveData]);

  const fallbackActive = !!liveData && (feedSummary.guide > 0 || !!liveData.offlineLinear);

  return (
    <PageTransition>
      <div className="tvsch-page relative min-h-screen overflow-hidden">
        <div className="tvsch-bg-orbs" aria-hidden="true">
          <span className="tvsch-bg-orb tvsch-bg-orb--cyan" />
          <span className="tvsch-bg-orb tvsch-bg-orb--magenta" />
          <span className="tvsch-bg-orb tvsch-bg-orb--violet" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.section {...heroReveal} className="tvsch-hero mb-6">
          <span className="tvsch-hero-scan" aria-hidden="true" />
          <span className="tvsch-hero-aurora tvsch-hero-aurora--cyan" aria-hidden="true" />
          <span className="tvsch-hero-aurora tvsch-hero-aurora--magenta" aria-hidden="true" />
          <span className="tvsch-hero-aurora tvsch-hero-aurora--amber" aria-hidden="true" />
          <div className="tvsch-hero-inner relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.25fr_.75fr]">
            <div className="relative z-10">
              <div className="tvsch-eyebrow">
                <span className="tvsch-live-dot" aria-hidden="true" />
                <span className="tvsch-eq" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                Anime TV · India
              </div>
              <h1 className="tvsch-hero-title mt-4">
                WHAT&apos;S ON <span>TV</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
                Indian TV &amp; streaming anime guide with exact IST slots, DTH numbers, and live now/next updates.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="tvsch-hero-chip">IST SLOTS</span>
                <span className="tvsch-hero-chip">TV + OTT</span>
                <span className="tvsch-hero-chip">{channels.length} SOURCES</span>
              </div>
              {liveData && (
                <div className="tvsch-feed-strip" aria-label="Schedule data sources">
                  <span className="tvsch-feed-chip">
                    <span className="tvsch-feed-dot tvsch-feed-dot--epg" aria-hidden="true" />
                    EPG.PW · {feedSummary.epg} TV feeds
                  </span>
                  <span className="tvsch-feed-chip">
                    <span className="tvsch-feed-dot tvsch-feed-dot--online" aria-hidden="true" />
                    ANILIST · {feedSummary.online} OTT feeds
                  </span>
                  <span className="tvsch-feed-chip tvsch-feed-chip--status" data-active={fallbackActive}>
                    <span className="tvsch-feed-dot" aria-hidden="true" />
                    {fallbackActive ? "Offline guide active" : "No fallback in use"}
                  </span>
                </div>
              )}
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="tvsch-stat">
                  <p className="tvsch-stat-label">
                    <span className="tvsch-stat-dot" aria-hidden="true" />
                    Slots today
                  </p>
                  <p className="tvsch-stat-value">{selectedDayStats.slots}</p>
                </div>
                <div className="tvsch-stat">
                  <p className="tvsch-stat-label">
                    <span className="tvsch-stat-dot" aria-hidden="true" />
                    Shows today
                  </p>
                  <p className="tvsch-stat-value">{selectedDayStats.shows}</p>
                </div>
                <div className="tvsch-stat">
                  <p className="tvsch-stat-label">
                    <span className="tvsch-stat-dot" aria-hidden="true" />
                    Channels
                  </p>
                  <p className="tvsch-stat-value">{channels.length}</p>
                </div>
                <div className="tvsch-stat">
                  <p className="tvsch-stat-label">
                    <span className="tvsch-stat-dot" aria-hidden="true" />
                    Week airings
                  </p>
                  <p className="tvsch-stat-value">{liveData?.liveAiringTotal ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="tvsch-signal relative z-10">
              <div className="tvsch-signal-screen">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="tvsch-stat-label">Today&apos;s grid</p>
                    <p className="font-display text-2xl font-bold text-[var(--color-ink)]">
                      {selectedDay}
                    </p>
                  </div>
                  <div className="tvsch-signal-ring" aria-hidden="true">
                    <span />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="tvsch-signal-row">
                    <span>Shows lined up</span>
                    <strong>{selectedDayStats.shows}</strong>
                  </div>
                  <div className="tvsch-signal-row">
                    <span>Channels with slots</span>
                    <strong>
                      {selectedDayStats.channels}/{liveData?.channels.length ?? channels.length}
                    </strong>
                  </div>
                  <div className="tvsch-signal-row">
                    <span>Week entries</span>
                    <strong>{liveData?.liveAiringTotal ?? 0}</strong>
                  </div>
                </div>
                <div className="tvsch-sync-row">
                  <span
                    className={`tvsch-sync-dot ${lastUpdated ? "" : "tvsch-sync-dot--idle"}`}
                    aria-hidden="true"
                  />
                  <span>
                    {lastUpdated ? `Feed synced ${lastUpdated}` : "Syncing live guide..."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <NowNextRail data={liveData} />

        <LiveAiringSection selectedDay={selectedDay} />

        <motion.div {...dayReveal} className="tvsch-day-strip mb-4">
          {days.map((day, i) => {
            const isToday = day === getDayName();
            const active = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                data-active={active}
                onClick={() => setSelectedDay(day)}
                className="tvsch-day-pill"
                style={{ "--tvsch-i": i } as React.CSSProperties}
              >
                {isToday && (
                  <span className="tvsch-eq tvsch-day-eq" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                <span className="block text-xs font-bold">
                  {isToday ? "TODAY" : day.slice(0, 3)}
                </span>
                <span className="mt-0.5 block font-mono text-[9px] text-[var(--color-mute)]">
                  {dayCounts[day] || 0} slots
                </span>
              </button>
            );
          })}
        </motion.div>

        <motion.div {...searchReveal} className="tvsch-search mb-4">
          <svg
            className="tvsch-search-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            aria-label="Search shows across all channels"
            placeholder="Search shows across all channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tvsch-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="tvsch-search-clear"
            >
              Clear
            </button>
          )}
        </motion.div>

        <ChannelFilterTabs
          selectedChannel={selectedChannel}
          onSelect={setSelectedChannel}
          counts={channelCounts}
          totalCount={dayCounts[selectedDay] || 0}
        />

        <motion.section {...gridReveal}>
          <div className="tvsch-grid-head">
            <div>
              <p className="tvsch-stat-label">Full channel grid</p>
              <h2 className="font-display text-lg font-bold text-[var(--color-ink)]">
                {selectedDay} line-up
              </h2>
            </div>
            <span className="tvsch-count-pill">{orderedChannels.length} sources</span>
          </div>
          <div className="tvsch-grid">
            {orderedChannels.map((ch, i) => {
              const liveSchedule = liveData?.channels.find(
                (lc) => lc.channelId === ch.id
              );
              return (
                <ChannelScheduleCard
                  key={ch.id}
                  channel={ch}
                  day={selectedDay}
                  searchQuery={searchQuery}
                  liveSchedule={liveSchedule}
                  index={i}
                />
              );
            })}
          </div>
        </motion.section>
        </div>
      </div>
    </PageTransition>
  );
}

export default function TvSchedulePageWrapper() {
  return (
    <ErrorBoundary>
      <TvSchedulePage />
    </ErrorBoundary>
  );
}
