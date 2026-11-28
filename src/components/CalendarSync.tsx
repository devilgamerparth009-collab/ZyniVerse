"use client";

import { useState } from "react";
import styles from "./CalendarSync.module.css";

interface CalendarSyncProps {
  animeId: number;
  title: string;
  nextEpisode?: {
    episode: number;
    airDate: string;
    timeUntil?: string;
  };
  className?: string;
  /** Anime detail pages keep every visitor on-site; only the .ics download remains. */
  internalOnly?: boolean;
}

export default function CalendarSync({ animeId, title, nextEpisode, className = "", internalOnly = false }: CalendarSyncProps) {
  const [synced, setSynced] = useState(false);

  const generateICalEvent = () => {
    if (!nextEpisode) return "";
    
    const startDate = new Date(nextEpisode.airDate);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    
    const formatICalDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ZyniVerse//Anime Schedule//EN
BEGIN:VEVENT
DTSTART:${formatICalDate(startDate)}
DTEND:${formatICalDate(endDate)}
SUMMARY:${title} - Episode ${nextEpisode.episode}
DESCRIPTION:Watch ${title} Episode ${nextEpisode.episode} on ZyniVerse
URL:https://zyverse.in/anime/${animeId}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
  };

  const generateGoogleCalendarUrl = () => {
    if (!nextEpisode) return "";
    
    const startDate = new Date(nextEpisode.airDate);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    
    const formatGoogleDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${title} - Episode ${nextEpisode.episode}`,
      dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
      details: `Watch ${title} Episode ${nextEpisode.episode} on ZyniVerse`,
      location: `https://zyverse.in/anime/${animeId}`,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const generateAppleCalendarUrl = () => {
    if (!nextEpisode) return "";
    
    const startDate = new Date(nextEpisode.airDate);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    
    const formatAppleDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const params = new URLSearchParams({
      begin: formatAppleDate(startDate),
      end: formatAppleDate(endDate),
      title: `${title} - Episode ${nextEpisode.episode}`,
      notes: `Watch ${title} Episode ${nextEpisode.episode} on ZyniVerse`,
      url: `https://zyverse.in/anime/${animeId}`,
    });

    return `webcal://zyverse.in/api/calendar?${params.toString()}`;
  };

  const handleDownloadICal = () => {
    const ical = generateICalEvent();
    const blob = new Blob([ical], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_episode_${nextEpisode?.episode || 1}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSynced(true);
  };

  if (!nextEpisode) {
    return (
      <div className={`${styles.card} ${className}`.trim()}>
        <p className={styles.empty}>No upcoming episode scheduled.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${className}`.trim()}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span className={styles.calendarIcon} aria-hidden="true">📅</span>
          Calendar Sync
        </h3>
        {synced && (
          <span className={styles.synced}>✓ Synced!</span>
        )}
      </div>

      <div className={styles.nextPanel}>
        <p className={styles.eyebrow}>Next Episode</p>
        <p className={styles.episode}>Episode {nextEpisode.episode}</p>
        <p className={styles.date}>
          {new Date(nextEpisode.airDate).toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        {nextEpisode.timeUntil && (
          <span className={styles.timePill}>{nextEpisode.timeUntil}</span>
        )}
      </div>

      <div className={styles.actions}>
        {!internalOnly && (
          <>
            <a
              href={generateGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSynced(true)}
              className={`${styles.action} ${styles.googleAction}`}
            >
              Google Calendar
            </a>
            <a
              href={generateAppleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSynced(true)}
              className={`${styles.action} ${styles.appleAction}`}
            >
              Apple Calendar
            </a>
          </>
        )}
        <button
          onClick={handleDownloadICal}
          className={`${styles.action} ${styles.icsAction}`}
        >
          Download .ics
        </button>
      </div>

      <p className={styles.note}>
        Add this anime to your calendar to never miss an episode!
      </p>
    </div>
  );
}
