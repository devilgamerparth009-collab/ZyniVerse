"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { AnimeEvent } from "@/lib/anime-events";
import EventCard from "./EventCard";

interface EventFiltersProps {
  events: AnimeEvent[];
  types: string[];
  countries: string[];
}

const STATUSES = ["all", "upcoming", "ongoing", "past"] as const;

export default function EventFilters({
  events,
  types,
  countries,
}: EventFiltersProps) {
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [type, setType] = useState("all");
  const [country, setCountry] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = events.filter((event) => {
    if (status !== "all" && event.status !== status) return false;
    if (type !== "all" && event.type !== type) return false;
    if (country !== "all" && event.country !== country) return false;
    if (search) {
      const needle = search.toLowerCase();
      if (
        !event.name.toLowerCase().includes(needle) &&
        !event.description.toLowerCase().includes(needle) &&
        !event.tags.some((tag) => tag.includes(needle))
      ) {
        return false;
      }
    }
    return true;
  });

  const ongoing = filtered.filter((event) => event.status === "ongoing");
  const upcoming = filtered.filter((event) => event.status === "upcoming");
  const past = filtered.filter((event) => event.status === "past");

  const groups = [
    { key: "ongoing", label: "Happening now", items: ongoing, tone: "blue" },
    { key: "upcoming", label: "Upcoming", items: upcoming, tone: "green" },
    { key: "past", label: "Past", items: past, tone: "muted" },
  ];

  return (
    <div className="evp-filters">
      <div className="evp-filter-top evp-filter-top-events">
        <label className="evp-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search events by name, description, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="evp-filter-row">
          <div className="evp-segments" role="group" aria-label="Filter by status">
            {STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`evp-segment ${status === value ? "evp-segment-active" : ""}`}
              >
                {value === "all" ? "All" : value}
              </button>
            ))}
          </div>

          <label className="evp-select-wrap">
            <span className="sr-only">Filter by type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="evp-select">
              <option value="all">All types</option>
              {types.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="evp-select-wrap">
            <span className="sr-only">Filter by country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="evp-select">
              <option value="all">All countries</option>
              {countries.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="evp-filter-summary" aria-live="polite">
          <span className="evp-filter-summary-dot" />
          Showing <strong>{filtered.length}</strong> of <strong>{events.length}</strong> tracked events
          <span className="evp-filter-summary-line" aria-hidden="true" />
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="evp-empty"
          >
            <span className="evp-empty-icon">⌁</span>
            <p>No events match these filters.</p>
            <p className="evp-empty-sub">Clear the search or choose another status.</p>
          </motion.div>
        ) : (
          <motion.div layout className="evp-groups">
            {groups.map((group) =>
              group.items.length > 0 ? (
                <motion.section
                  layout
                  key={group.key}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  className="evp-group"
                >
                  <div className={`evp-group-head evp-group-head-${group.tone}`}>
                    <span className={`evp-group-dot evp-group-dot-${group.tone}`} />
                    <h3>{group.label}</h3>
                    <span className="evp-group-rule" aria-hidden="true" />
                    <span className="evp-group-count">
                      <span className="evp-group-count-num">{group.items.length}</span>
                      events
                    </span>
                  </div>
                  <div className="evp-card-grid">
                    {group.items.map((event, index) => (
                      <EventCard key={event.id} event={event} index={index} />
                    ))}
                  </div>
                </motion.section>
              ) : null
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
