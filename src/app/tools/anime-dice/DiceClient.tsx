"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { bestTitle } from "@/lib/anilist";
import { useWatchlist } from "@/components/WatchlistProvider";

interface Entry {
  label: string;
  href?: string;
}

const SAMPLE: Entry[] = [
  { label: "Fullmetal Alchemist: Brotherhood" },
  { label: "Steins;Gate" },
  { label: "Mob Psycho 100" },
  { label: "Vinland Saga" },
  { label: "Cowboy Bebop" },
  { label: "Frieren: Beyond Journey's End" },
];

/** Uniform random index in [0, max) using the platform CSPRNG. */
function randomIndex(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

export default function DiceClient() {
  const { items } = useWatchlist();
  const [mode, setMode] = useState<"custom" | "watchlist">("custom");
  const [text, setText] = useState(SAMPLE.map((entry) => entry.label).join("\n"));
  const [count, setCount] = useState(1);
  const [picks, setPicks] = useState<Entry[]>([]);
  const [rollId, setRollId] = useState(0);

  const customEntries = useMemo<Entry[]>(
    () =>
      text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((label) => ({ label })),
    [text],
  );

  const watchlistEntries = useMemo<Entry[]>(
    () =>
      items
        .filter((item) => item.title)
        .map((item) => ({
          label: bestTitle(item.title),
          href: `/anime/${item.id}`,
        })),
    [items],
  );

  const pool = mode === "watchlist" ? watchlistEntries : customEntries;

  const roll = () => {
    if (pool.length === 0) return;
    const remaining = [...pool];
    const next: Entry[] = [];
    const wanted = Math.min(count, remaining.length);
    for (let i = 0; i < wanted; i += 1) {
      const idx = randomIndex(remaining.length);
      next.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    setPicks(next);
    setRollId((id) => id + 1);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-[var(--color-panel)]/40 p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              mode === "custom"
                ? "bg-[var(--color-cyan)] text-black"
                : "border border-white/15 text-[var(--color-mute)] hover:border-white/30"
            }`}
          >
            Custom list
          </button>
          <button
            type="button"
            onClick={() => setMode("watchlist")}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              mode === "watchlist"
                ? "bg-[var(--color-cyan)] text-black"
                : "border border-white/15 text-[var(--color-mute)] hover:border-white/30"
            }`}
          >
            My watchlist ({watchlistEntries.length})
          </button>
        </div>

        {mode === "custom" ? (
          <div className="mt-4">
            <label
              htmlFor="dice-pool"
              className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-mute)]"
            >
              One title per line
            </label>
            <textarea
              id="dice-pool"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-white/10 bg-[var(--color-void)] px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-cyan)]/50"
              placeholder={"One title per line…\nFrieren\nSteins;Gate\nMob Psycho 100"}
            />
            <p className="mt-2 text-xs text-[var(--color-mute)]">
              {customEntries.length} {customEntries.length === 1 ? "title" : "titles"} in the pool
            </p>
          </div>
        ) : (
          <div className="mt-4">
            {watchlistEntries.length === 0 ? (
              <p className="text-sm text-[var(--color-mute)]">
                Your watchlist is empty.{" "}
                <Link href="/search" className="text-[var(--color-cyan)] underline">
                  Add a few anime
                </Link>{" "}
                and come back.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-mute)]">
                {watchlistEntries.length} titles from your list are in the pool.{" "}
                <Link href="/watchlist" className="text-[var(--color-cyan)] underline">
                  Manage watchlist
                </Link>
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="dice-count"
              className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-mute)]"
            >
              Picks
            </label>
            <select
              id="dice-count"
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="rounded-lg border border-white/10 bg-[var(--color-void)] px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={roll}
            disabled={pool.length === 0}
            className="rounded-xl bg-gradient-to-r from-[var(--color-cyan)] to-[var(--color-magenta)] px-6 py-3 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🎲 Roll the dice
          </button>
        </div>
      </section>

      <section aria-live="polite" aria-atomic="true">
        {picks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[var(--color-mute)]">
            Roll to pick something to watch. No sign-up, no tracking — the dice run
            entirely in your browser.
          </p>
        ) : (
          <motion.ul
            key={rollId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 sm:grid-cols-2"
          >
            {picks.map((pick, index) => (
              <li
                key={`${pick.label}-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/5 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-cyan)]/15 font-mono text-sm font-bold text-[var(--color-cyan)]">
                  {index + 1}
                </span>
                {pick.href ? (
                  <Link
                    href={pick.href}
                    className="text-sm font-semibold text-[var(--color-ink)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-cyan)]"
                  >
                    {pick.label}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{pick.label}</span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </section>

      <p className="text-xs leading-relaxed text-[var(--color-mute)]">
        The picker uses your browser&apos;s secure random number generator and
        removes each winner from the pool so you never get the same title twice in
        one roll. Nothing is sent to the server.
      </p>
    </div>
  );
}
