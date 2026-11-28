"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import styles from "@/app/conventions/conventions.module.css";
import { allBrowseStates } from "@/lib/convention-locations";

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

interface StateGroup {
  state: string;
  cities: Map<string, Convention[]>;
}

const DOT_CLASS: Record<string, string> = {
  upcoming: styles.dotUpcoming,
  ongoing: styles.dotOngoing,
  past: styles.dotPast,
  cancelled: styles.dotCancelled,
};

const EASE = [0.22, 1, 0.36, 1] as const;

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function handlePanelGlow(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--glow-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
}

export default function ConventionMap() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [allConvs, setAllConvs] = useState<Convention[]>([]);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch("/api/conventions?status=all");
        const data = await res.json();
        setAllConvs(data.conventions || []);
      } catch {
        setAllConvs([]);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const groupedByState = useMemo<StateGroup[]>(() => {
    const map = new Map<string, Map<string, Convention[]>>();
    for (const convention of allConvs) {
      if (!map.has(convention.state)) map.set(convention.state, new Map());
      const cities = map.get(convention.state)!;
      if (!cities.has(convention.city)) cities.set(convention.city, []);
      cities.get(convention.city)!.push(convention);
    }
    return Array.from(map.entries())
      .map(([state, cities]) => ({ state, cities }))
      .sort((a, b) => a.state.localeCompare(b.state));
  }, [allConvs]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of groupedByState) {
      map.set(group.state, Array.from(group.cities.values()).reduce((sum, list) => sum + list.length, 0));
    }
    return map;
  }, [groupedByState]);

  const browseStates = useMemo(
    () => allBrowseStates(allConvs.map((convention) => convention.state)),
    [allConvs]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const activeStates = useMemo(
    () => browseStates.filter((state) => counts.has(state) && state.toLowerCase().includes(normalizedQuery)),
    [browseStates, counts, normalizedQuery]
  );
  const quietStates = useMemo(
    () => browseStates.filter((state) => !counts.has(state) && state.toLowerCase().includes(normalizedQuery)),
    [browseStates, counts, normalizedQuery]
  );
  const groupMap = useMemo(
    () => new Map(groupedByState.map((group) => [group.state, group])),
    [groupedByState]
  );

  const chipMotion = useMemo(
    () => (index: number) =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 8, scale: 0.97 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, scale: 0.94 },
            transition: { duration: 0.3, delay: Math.min(index * 0.018, 0.28), ease: EASE },
          },
    [reduceMotion]
  );

  const panelMotion = useMemo(
    () => (index: number) =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 18 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.12 },
            transition: { duration: 0.45, delay: Math.min(index * 0.05, 0.3), ease: EASE },
          },
    [reduceMotion]
  );

  const cityMotion = useMemo(
    () => (index: number) =>
      reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 10 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.2 },
            transition: { duration: 0.38, delay: Math.min(index * 0.05, 0.25), ease: EASE },
          },
    [reduceMotion]
  );

  const coveragePercent = browseStates.length
    ? Math.round((groupedByState.length / browseStates.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className={styles.skeletonGrid} role="status" aria-label="Loading locations">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.skeletonCard} style={{ animationDelay: `${index * 90}ms` }} />
        ))}
        <span className={styles.srOnly}>Loading locations…</span>
      </div>
    );
  }

  const renderStateChip = (state: string, index: number) => {
    const count = counts.get(state) ?? 0;
    const selected = selectedState === state;

    return (
      <motion.button
        key={state}
        type="button"
        layout={!reduceMotion}
        onClick={() => setSelectedState(state)}
        aria-pressed={selected}
        whileHover={reduceMotion ? undefined : { y: -3 }}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        className={`${styles.stateChipCard} ${count === 0 ? styles.stateChipQuiet : ""} ${selected ? styles.stateChipActive : ""}`}
        {...chipMotion(index)}
      >
        {count > 0 && <span className={styles.stateChipDot} />}
        <span className={styles.stateChipName}>{state}</span>
        <motion.span
          key={count}
          className={styles.stateChipCount}
          initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 24, delay: Math.min(index * 0.01, 0.2) }}
        >
          {count}
        </motion.span>
      </motion.button>
    );
  };

  const renderStatePanel = (group: StateGroup, index: number) => {
    const cityEntries = Array.from(group.cities.entries()).sort(([a], [b]) => a.localeCompare(b));
    const total = counts.get(group.state) ?? 0;

    return (
      <motion.section
        key={group.state}
        className={`${styles.surface} ${styles.statePanel}`}
        onMouseMove={handlePanelGlow}
        {...panelMotion(index)}
      >
        <div className={styles.stateHead}>
          <LocationIcon className={styles.metaIcon} />
          <h3 className={styles.stateTitle}>{group.state}</h3>
          <span className={styles.monthCount}>
            {total} event{total !== 1 ? "s" : ""}
          </span>
        </div>

        <div className={styles.cityGrid}>
          {cityEntries.map(([city, conventions], cityIndex) => (
            <motion.div key={city} className={styles.cityCard} {...cityMotion(cityIndex)}>
              <div className={styles.cityHead}>
                <h4 className={styles.cityName}>{city}</h4>
                <motion.span
                  className={styles.cityCount}
                  initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: cityIndex * 0.04, ease: EASE }}
                >
                  {conventions.length}
                </motion.span>
              </div>
              <div className={styles.eventList}>
                {conventions.map((convention) => (
                  <Link key={convention.id} href={`/conventions/${convention.id}`} className={styles.eventLink}>
                    <span className={`${styles.eventDot} ${DOT_CLASS[convention.status] || styles.dotUpcoming}`} />
                    <span>{convention.shortName || convention.name}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    );
  };

  const renderQuietPanel = (state: string, index: number) => (
    <motion.section
      key={`quiet-${state}`}
      className={`${styles.surface} ${styles.quietPanel}`}
      {...panelMotion(index)}
    >
      <span className={styles.quietIcon}><LocationIcon /></span>
      <h3 className={styles.stateTitle}>{state}</h3>
      <p className={styles.quietText}>
        No verified conventions here yet. Listings appear automatically after an organiser
        publishes the event and the daily source check confirms it.
      </p>
      <motion.button
        type="button"
        className={styles.ghostButton}
        onClick={() => setSelectedState(null)}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      >
        View all states
      </motion.button>
    </motion.section>
  );

  return (
    <div>
      <section className={`${styles.surface} ${styles.explorer}`} aria-labelledby="state-explorer-heading">
        <div className={styles.explorerHead}>
          <div>
            <span className={styles.sectionKicker}>State explorer</span>
            <h3 id="state-explorer-heading" className={styles.explorerTitle}>Pick your state or UT</h3>
          </div>

          <div className={styles.explorerTools}>
            <label className={styles.searchWrap}>
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find your state…"
                aria-label="Search states and union territories"
                className={styles.searchInput}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className={styles.clearSearch}
                >
                  ×
                </button>
              )}
            </label>

            <motion.button
              type="button"
              layout={!reduceMotion}
              onClick={() => setSelectedState(null)}
              aria-pressed={selectedState === null}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              className={`${styles.allStatesChip} ${selectedState === null ? styles.stateChipActive : ""}`}
            >
              All States
              <motion.span
                key={allConvs.length}
                className={styles.stateChipCount}
                initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                {allConvs.length}
              </motion.span>
            </motion.button>
          </div>
        </div>

        <div className={styles.coverageBlock}>
          <div className={styles.coverageMeta}>
            <span className={styles.liveDot} />
            <span>{browseStates.length} states &amp; UTs</span>
            <span className={styles.liveSeparator}>•</span>
            <span>{groupedByState.length} with verified events</span>
            <span className={styles.coveragePercent}>{coveragePercent}% covered</span>
          </div>
          <div
            className={styles.coverageTrack}
            role="progressbar"
            aria-valuenow={groupedByState.length}
            aria-valuemin={0}
            aria-valuemax={browseStates.length}
            aria-label="States with verified conventions"
          >
            <motion.div
              className={styles.coverageFill}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${coveragePercent}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: EASE }}
            />
          </div>
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {activeStates.length > 0 && (
            <div key="active-states" className={styles.stateGroup}>
              <div className={styles.groupHead}>
                <span className={`${styles.groupDot} ${styles.groupDotLive}`} />
                <h4 className={styles.groupTitle}>With verified events</h4>
                <span className={styles.groupCount}>{activeStates.length}</span>
              </div>
              <div className={styles.chipGrid}>
                {activeStates.map((state, index) => renderStateChip(state, index))}
              </div>
            </div>
          )}

          {quietStates.length > 0 && (
            <div key="quiet-states" className={styles.stateGroup}>
              <div className={styles.groupHead}>
                <span className={styles.groupDot} />
                <h4 className={styles.groupTitle}>No verified events yet</h4>
                <span className={styles.groupCount}>{quietStates.length}</span>
              </div>
              <div className={`${styles.chipGrid} ${styles.chipGridQuiet}`}>
                {quietStates.map((state, index) => renderStateChip(state, activeStates.length + index))}
              </div>
            </div>
          )}
        </AnimatePresence>

        {activeStates.length === 0 && quietStates.length === 0 && (
          <p className={styles.quietText}>No state or UT matches “{query}”.</p>
        )}
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selectedState ?? "all"}
          className={styles.locationResults}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {selectedState ? (
            groupMap.has(selectedState) ? (
              renderStatePanel(groupMap.get(selectedState)!, 0)
            ) : (
              renderQuietPanel(selectedState, 0)
            )
          ) : (
            groupedByState.map((group, index) => renderStatePanel(group, index))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
