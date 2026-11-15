import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getVibeSnapshot } from "@/lib/vibe";
import { FadeIn } from "@/components/PageTransition";
import { logError } from "@/lib/logger";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Vibe — What Anime Fans Are Watching Now",
  description:
    "A privacy-first pulse of the ZyniVerse community: the titles fans are watching right now, live watch parties, and the shape of the fandom. Counts only — never names.",
  openGraph: {
    title: "Vibe — What Anime Fans Are Watching Now",
    description:
      "The ZyniVerse community pulse. See what everyone is watching right now, plus live watch parties.",
  },
};

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 px-4 py-3"
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)` }}
    >
      <p className="font-display text-2xl font-black tracking-tight" style={{ color: accent }}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-mute)]">
        {label}
      </p>
    </div>
  );
}

export default async function VibePage() {
  let snapshot: Awaited<ReturnType<typeof getVibeSnapshot>> | null = null;
  try {
    snapshot = await getVibeSnapshot();
  } catch (e) {
    logError(e);
  }

  const pulse = snapshot?.pulse;
  const maxFans = snapshot?.nowWatching.reduce((m, t) => Math.max(m, t.fans), 0) || 0;

  return (
    <main className="relative mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(50% 50% at 30% 20%, rgba(255,122,217,0.42), transparent 70%), radial-gradient(50% 50% at 70% 15%, rgba(0,255,224,0.24), transparent 70%), radial-gradient(40% 40% at 50% 85%, rgba(138,92,255,0.22), transparent 70%)",
        }}
      />

      <section className="mb-8 text-center">
        <p className="console-label mb-3 inline-flex items-center gap-2 text-[var(--color-magenta)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-magenta)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-magenta)]" />
          </span>
          Live community pulse
        </p>
        <h1 className="neon-text-gradient font-display text-3xl font-black tracking-tight sm:text-5xl">
          Vibe
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-mute)]">
          Poore fandom ka mood ek jagah — kaun kya dekh raha hai abhi, kaunse rooms live hain, aur
          kaunse titles sabse zyada chal rahe hain. Sirf counts, kabhi naam nahi. 🔒
        </p>
      </section>

      {!snapshot || !pulse ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-10 text-center">
          <p className="text-4xl">📡</p>
          <p className="mt-3 font-display text-lg font-bold text-[var(--color-ink)]">Signal unavailable</p>
          <p className="mt-1 text-sm text-[var(--color-mute)]">
            The pulse could not be read right now. Refresh in a moment.
          </p>
        </div>
      ) : (
        <>
          <FadeIn>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Fans" value={pulse.fans.toLocaleString()} accent="var(--color-magenta)" />
              <Stat label="Titles" value={pulse.titles.toLocaleString()} accent="#c084fc" />
              <Stat label="Episodes logged" value={pulse.episodes.toLocaleString()} accent="var(--color-cyan)" />
              <Stat label="Live rooms" value={pulse.liveRooms.toLocaleString()} accent="#22c55e" />
            </div>
          </FadeIn>

          {snapshot.liveRooms.length > 0 && (
            <FadeIn delay={0.05}>
              <section className="mt-10">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-lg font-black text-[var(--color-ink)]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    Live watch parties
                  </h2>
                  <Link
                    href="/watch-party"
                    className="text-xs font-bold uppercase tracking-wider text-[var(--color-cyan)] hover:underline"
                  >
                    See all →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {snapshot.liveRooms.map((room) => (
                    <Link
                      key={room.id}
                      href={`/watch-party/${room.id}`}
                      className="group overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 transition-colors hover:border-[var(--color-cyan)]/60"
                    >
                      <div className="relative aspect-[4/3] w-full bg-black/40">
                        {room.image ? (
                          <Image
                            src={room.image}
                            alt={room.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-2xl">🍿</div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                          Live
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-xs font-bold leading-snug text-[var(--color-ink)]">
                          {room.title}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--color-mute)]">
                          EP {room.episode} · {room.members} in room
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </FadeIn>
          )}

          <FadeIn delay={0.1}>
            <section className="mt-10">
              <div className="mb-3 flex items-end justify-between">
                <h2 className="font-display text-lg font-black text-[var(--color-ink)]">Now watching</h2>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-mute)]">
                  Last {snapshot.windowDays} days
                </p>
              </div>

              {snapshot.nowWatching.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-10 text-center">
                  <p className="text-4xl">🌙</p>
                  <p className="mt-3 font-display text-base font-bold text-[var(--color-ink)]">
                    The room is quiet
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-mute)]">
                    Jab fans apni lists update karenge, pulse yahan light up ho jayega.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {snapshot.nowWatching.map((item, i) => {
                    const accent = i === 0 ? "var(--color-magenta)" : i === 1 ? "#c084fc" : i === 2 ? "var(--color-cyan)" : "var(--color-mute)";
                    const pct = maxFans > 0 ? Math.max(6, Math.round((item.fans / maxFans) * 100)) : 6;
                    return (
                      <li key={item.mediaId}>
                        <Link
                          href={`/anime/${item.mediaId}`}
                          className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-2.5 transition-colors hover:border-[var(--color-cyan)]/50"
                        >
                          <span
                            className="w-6 shrink-0 text-center font-display text-lg font-black"
                            style={{ color: accent }}
                          >
                            {i + 1}
                          </span>
                          <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-black/40">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.title}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm">🎬</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[var(--color-ink)]">{item.title}</p>
                            <p className="mt-0.5 text-[11px]" style={{ color: accent }}>
                              {item.fans.toLocaleString()} {item.fans === 1 ? "fan" : "fans"} watching ·{" "}
                              <span className="text-[var(--color-mute)]">{item.events.toLocaleString()} logs</span>
                            </p>
                            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="mt-10 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-4">
              <p className="text-sm font-bold text-[var(--color-ink)]">🔒 Privacy first</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">
                Vibe sirf counts dikhata hai. Koi username, user id ya kisi ki personal watchlist
                kabhi return nahi hoti — bas fandom ka shape.
              </p>
            </div>
          </FadeIn>

          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-mute)]">
            Updated {new Date(snapshot.generatedAt).toLocaleString()} · ZyniVerse
          </p>
        </>
      )}
    </main>
  );
}
