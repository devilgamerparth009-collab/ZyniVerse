"use client";

import { useEffect, useState } from "react";

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function getParts(target: number): CountdownParts {
  const diff = target - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, done: false };
}

const CELLS: { key: keyof CountdownParts; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Mins" },
  { key: "seconds", label: "Secs" },
];

export default function EventCountdown({ target }: { target: string }) {
  const [parts, setParts] = useState<CountdownParts>(() =>
    getParts(new Date(target).getTime())
  );

  useEffect(() => {
    const targetTime = new Date(target).getTime();
    const id = setInterval(() => setParts(getParts(targetTime)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (parts.done) {
    return (
      <div className="evp-count-done">
        <span className="evp-count-done-dot" />
        Event has started
      </div>
    );
  }

  return (
    <div className="evp-count-grid">
      {CELLS.map(({ key, label }) => {
        const value = parts[key];
        const isSeconds = key === "seconds";
        return (
          <div
            key={key}
            className={`evp-count-cell ${isSeconds ? "evp-count-cell-seconds" : ""}`}
          >
            <span className="evp-count-value">{String(value).padStart(2, "0")}</span>
            <span className="evp-count-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
