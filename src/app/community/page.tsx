import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community",
  description: "Find people, follow channels, watch stories, and join the conversation on ZyniVerse.",
};

const CARDS = [
  {
    href: "/posts",
    label: "Posts",
    description: "See and share updates with the whole community.",
    icon: (
      <path d="M4 5h16v11H8l-4 4V5z" />
    ),
  },
  {
    href: "/people",
    label: "Find People",
    description: "Discover fans you may know and follow them.",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M16 11h6" />
      </>
    ),
  },
  {
    href: "/channels",
    label: "Channels",
    description: "Subscribe to broadcasts and read their posts.",
    icon: (
      <path d="M4 11a9 9 0 0116 0M7 14a5 5 0 0110 0M12 18h.01M2 8a11 11 0 0120 0" />
    ),
  },
  {
    href: "/stories",
    label: "Stories",
    description: "Watch short updates that last for a day.",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </>
    ),
  },
  {
    href: "/friends",
    label: "Friends",
    description: "Manage friend requests and chat with friends.",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87" />
      </>
    ),
  },
  {
    href: "/clubs",
    label: "Clubs",
    description: "Join groups built around the shows you love.",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
  },
  {
    href: "/forum",
    label: "Forum",
    description: "Longer discussions and detailed conversations.",
    icon: (
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    ),
  },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--color-cyan)" }}>
          Community
        </span>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl text-[var(--color-ink)]">
          Connect with other fans
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--color-mute)]">
          Pick a place to start. Every corner of the community is one click away.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl neon-rgb-border bg-[var(--color-panel)]/60 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--color-panel)]"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {card.icon}
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-cyan)]">
                {card.label}
              </h2>
              <span className="ml-auto text-sm text-[var(--color-mute)] transition-transform group-hover:translate-x-0.5">→</span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-mute)]">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
