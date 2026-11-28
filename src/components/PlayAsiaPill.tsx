"use client";

import { useCallback } from "react";
import { playasiaUrl } from "@/lib/affiliate-config";
import { logError } from "@/lib/logger";

interface Props {
  query?: string;
  label?: string;
  className?: string;
}

export default function PlayAsiaPill({ query, label = "Play-Asia", className = "" }: Props) {
  const href = playasiaUrl(query);

  const handleClick = useCallback(async () => {
    try {
      await fetch("/api/affiliate/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner: "playasia", page: window.location.pathname }),
      });
    } catch (e) { logError(e); }
  }, []);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={handleClick}
      aria-label={`${label} — sponsored link`}
      className={`group inline-flex items-center gap-2 rounded-full border border-[var(--color-magenta)]/35 bg-[var(--color-panel)]/75 px-3 py-1.5 text-[10px] font-semibold text-[var(--color-ink)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[var(--color-magenta)] hover:bg-[var(--color-magenta)]/10 ${className}`}
    >
      <span aria-hidden="true">🛒</span>
      <span>{label}</span>
      <span className="rounded-full bg-[var(--color-magenta)]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--color-magenta)]">
        Sponsored
      </span>
    </a>
  );
}
