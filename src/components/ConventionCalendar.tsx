"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import MiniCalendar from "./MiniCalendar";
import styles from "@/app/conventions/conventions.module.css";
import {
  daysUntilDate,
  formatLongMonth,
  formatShortDateRange,
  getDateParts,
  getMonthKey,
} from "@/lib/convention-dates";

interface Convention {
  id: string;
  name: string;
  shortName: string | null;
  city: string;
  state: string;
  venue: string;
  startDate: string;
  endDate: string;
  website: string;
  ticketUrl: string | null;
  image: string | null;
  description: string;
  estimatedAttendance: number | null;
  status: "upcoming" | "ongoing" | "past" | "cancelled";
  organizers: string[];
  tags: string[];
}

const STATUS_CLASS: Record<string, string> = {
  upcoming: styles.statusUpcoming,
  ongoing: styles.statusOngoing,
  past: styles.statusPast,
  cancelled: styles.statusCancelled,
};

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EASE = [0.22, 1, 0.36, 1] as const;

function MediaIcon({ className }: { className?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function fallbackCode(name: string, shortName: string | null): string {
  const source = shortName || name;
  const letters = source.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return letters.slice(0, 3) || "EV";
}

export default function ConventionCalendar() {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("upcoming");
  const [monthFilter, setMonthFilter] = useState("");
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion() ?? false;

  const stagger = useMemo(
    () => (index: number) =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 18 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.15 },
            transition: { duration: 0.45, delay: Math.min(index * 0.045, 0.35), ease: EASE },
          },
    [reduceMotion]
  );

  useEffect(() => {
    const fetchConventions = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (cityFilter) params.set("city", cityFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (monthFilter) params.set("month", monthFilter);
      try {
        const res = await fetch(`/api/conventions?${params.toString()}`);
        const data = await res.json();
        setConventions(data.conventions || []);
      } catch {
        setConventions([]);
      }
      setLoading(false);
    };
    fetchConventions();
  }, [cityFilter, statusFilter, monthFilter]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await fetch("/api/conventions?status=all");
        const data = await res.json();
        const uniqueCities = [...new Set((data.conventions || []).map((c: Convention) => c.city))].sort() as string[];
        setCities(uniqueCities);
      } catch {
        setCities([]);
      }
    };
    fetchCities();
  }, []);

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="View mode">
          {(["list", "calendar"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`${styles.chip} ${view === option ? styles.chipActive : ""}`}
            >
              {option === "list" ? "List" : "Calendar"}
            </button>
          ))}
        </div>

        <div className={styles.selectWrap}>
          <select
            aria-label="Filter by city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className={styles.select}
          >
            <option value="">All Cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <span className={styles.selectCaret} aria-hidden="true">▾</span>
        </div>

        <div className={styles.segmented} role="group" aria-label="Filter by status">
          {["all", "upcoming", "ongoing", "past"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={statusFilter === status}
              className={`${styles.chip} ${statusFilter === status ? styles.chipPinkActive : ""}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.selectWrap}>
          <select
            aria-label="Filter by month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className={styles.select}
          >
            <option value="">All Months</option>
            {MONTHS.filter(Boolean).map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
          <span className={styles.selectCaret} aria-hidden="true">▾</span>
        </div>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className={styles.skeletonGrid} role="status" aria-label="Loading conventions">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={styles.skeletonCard} style={{ animationDelay: `${index * 80}ms` }} />
            ))}
            <span className={styles.srOnly}>Loading conventions…</span>
          </div>
        ) : view === "list" ? (
          <div className={styles.grid}>
            {conventions.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <CalendarIcon />
                </span>
                <strong>No conventions found</strong>
                <span>Try another city, month, or status.</span>
              </div>
            ) : (
              conventions.map((convention, index) => (
                <motion.div key={convention.id} className={styles.cardWrap} {...stagger(index)}>
                  <ConventionCard convention={convention} miniPanelClassName={styles.miniPanel} />
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <CalendarView conventions={conventions} stagger={stagger} />
        )}
      </div>
    </div>
  );
}

function ConventionCard({
  convention: c,
  miniPanelClassName,
}: {
  convention: Convention;
  miniPanelClassName?: string;
}) {
  const dateStr = formatShortDateRange(c.startDate, c.endDate);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDaysLeft(Math.max(0, daysUntilDate(c.startDate)));
    }, 0);
    return () => clearTimeout(timer);
  }, [c.startDate]);

  const handleGlow = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--glow-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
  };

  return (
    <article className={`${styles.surface} ${styles.card}`} onMouseMove={handleGlow}>
      <div className={styles.media}>
        {c.image ? (
          <>
            <Image
              src={c.image}
              alt={c.name}
              fill
              className={styles.mediaImage}
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div className={styles.mediaFade} />
          </>
        ) : (
          <div className={styles.mediaFallback}>
            <span className={styles.fallbackCode}>{fallbackCode(c.name, c.shortName)}</span>
          </div>
        )}
      </div>

      <div className={styles.badges}>
        <div className={styles.badgeGroup}>
          <span className={`${styles.badge} ${STATUS_CLASS[c.status] || styles.statusUpcoming}`}>
            <span className={styles.badgeDot} />
            {c.status}
          </span>
          {c.status === "upcoming" && daysLeft > 0 && (
            <span className={`${styles.badge} ${styles.countdown}`}>{daysLeft}d left</span>
          )}
        </div>
        {c.estimatedAttendance && (
          <span className={`${styles.badge} ${styles.attendance}`}>
            <PeopleIcon />
            {c.estimatedAttendance.toLocaleString("en-IN")}+
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.metaRow}>
          <MediaIcon className={styles.metaIcon} />
          <span>{c.city}{c.state ? `, ${c.state}` : ""}</span>
        </div>

        <Link href={`/conventions/${c.id}`} className={styles.cardLink}>
          <h3 className={styles.title}>{c.name}</h3>
        </Link>

        <div className={`${styles.metaRow} ${styles.date}`}>
          <CalendarIcon className={styles.metaIconPink} />
          <span>{dateStr}</span>
        </div>

        {c.tags.length > 0 && (
          <div className={styles.tags}>
            {c.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
            {c.tags.length > 3 && <span className={styles.tagMore}>+{c.tags.length - 3}</span>}
          </div>
        )}

        <div className={styles.actions}>
          <MiniCalendar
            startDate={c.startDate}
            endDate={c.endDate}
            name={c.name}
            label="+ Calendar"
            buttonClassName={styles.ghostButton}
            panelClassName={miniPanelClassName}
          />
          {c.ticketUrl && (
            <a
              href={c.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ticketButton}
            >
              Tickets
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function CalendarView({
  conventions,
  stagger,
}: {
  conventions: Convention[];
  stagger: (index: number) => Record<string, unknown>;
}) {
  const months = useMemo(() => {
    const map = new Map<string, Convention[]>();
    for (const convention of conventions) {
      const key = getMonthKey(convention.startDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(convention);
    }
    return Array.from(map.entries()).sort();
  }, [conventions]);

  if (months.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}><CalendarIcon /></span>
        <strong>No conventions in this view</strong>
        <span>Try a different filter combination.</span>
      </div>
    );
  }

  return (
    <div className={styles.monthStack}>
      {months.map(([key, monthConventions], monthIndex) => {
        const [year, month] = key.split("-");
        const monthName = formatLongMonth(Number(month));
        const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
        const activeDays = new Set<number>();

        for (const convention of monthConventions) {
          const start = getDateParts(convention.startDate);
          const end = getDateParts(convention.endDate);
          if (start.year !== Number(year) || start.month !== Number(month)) continue;
          const lastDay = start.month === end.month && start.year === end.year ? end.day : daysInMonth;
          for (let day = start.day; day <= lastDay; day++) activeDays.add(day);
        }

        return (
          <motion.section key={key} className={`${styles.surface} ${styles.monthPanel}`} {...stagger(monthIndex)}>
            <h3 className={styles.monthTitle}>
              {monthName} {year}
              <span className={styles.monthCount}>
                {monthConventions.length} event{monthConventions.length !== 1 ? "s" : ""}
              </span>
            </h3>

            <div className={styles.calendarGrid}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className={styles.weekday}>{day}</span>
              ))}
              {Array.from({ length: new Date(Number(year), Number(month) - 1, 1).getDay() }, (_, index) => (
                <span key={`blank-${index}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                return (
                  <span key={day} className={`${styles.day} ${activeDays.has(day) ? styles.dayActive : ""}`}>
                    {day}
                  </span>
                );
              })}
            </div>

            <div className={styles.eventList}>
              {monthConventions.map((convention) => (
                <Link key={convention.id} href={`/conventions/${convention.id}`} className={styles.eventLink}>
                  <span className={styles.eventDot} />
                  <span>{convention.name}</span>
                  <span className={styles.eventCity}>{convention.city}</span>
                </Link>
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
