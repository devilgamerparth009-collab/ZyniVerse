import type { Metadata } from "next";
import Link from "next/link";
import { MOBILE_RELEASE } from "@/lib/mobile-release";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Changelog & Release Notes — ZyniVerse Website and Android App",
  description:
    "Every ZyniVerse release in one place: Android app versions, website features, fixes and security changes — including APK SHA-256 verification.",
  keywords: [
    "zyniverse changelog",
    "zyniverse release notes",
    "zyniverse android update",
    "zyniverse apk version",
    "anime app release notes",
  ],
  alternates: { canonical: `${BASE_URL}/changelog` },
  openGraph: {
    title: "ZyniVerse Changelog & Release Notes",
    description:
      "Android app versions, website features, fixes and APK hash verification — every ZyniVerse release in one place.",
    url: `${BASE_URL}/changelog`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZyniVerse Changelog & Release Notes",
    description: "Android app versions, website features and APK hash verification.",
  },
};

type ChangeType = "feature" | "fix" | "security" | "improvement";

interface Release {
  version: string;
  date: string;
  channel: "Android app" | "Website";
  summary: string;
  changes: { type: ChangeType; text: string }[];
}

const LABELS: Record<ChangeType, string> = {
  feature: "New",
  fix: "Fix",
  security: "Security",
  improvement: "Improved",
};

const TYPE_STYLES: Record<ChangeType, string> = {
  feature: "border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]",
  fix: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  security: "border-[var(--color-magenta)]/40 bg-[var(--color-magenta)]/10 text-[var(--color-magenta)]",
  improvement: "border-violet-400/40 bg-violet-400/10 text-violet-300",
};

const APP_RELEASES: Release[] = [
  {
    version: "1.4.3",
    date: "20 November 2026",
    channel: "Android app",
    summary:
      "Cleaner launch build: no third-party site shortcuts, a new Aurora theme, Episode Pulse and a corrected update badge.",
    changes: [
      {
        type: "security",
        text: "All user-facing links now stay on zyverse.in; Dub Hub, news, feed, channels, alerts and media tiles no longer open third-party sites.",
      },
      {
        type: "feature",
        text: "Episode Pulse shows the exact episodes receiving anonymous community reactions this week.",
      },
      {
        type: "improvement",
        text: "Aurora Launch replaces the Diwali theme with a cyan, blue and violet look and a softer glow overlay.",
      },
      {
        type: "fix",
        text: "The Install button no longer appears for a build that is already installed or no longer matches the published release.",
      },
      {
        type: "security",
        text: "APK hash and size verification still runs before install, and failed or stale downloads are deleted.",
      },
      {
        type: "improvement",
        text: "Signed with the same certificate as 1.4.1 and 1.4.2, so existing installs keep their data.",
      },
    ],
  },
  {
    version: "1.4.2",
    date: "19 November 2026",
    channel: "Android app",
    summary:
      "Every APK download is now verified against the published SHA-256 hash and byte size before the installer opens.",
    changes: [
      {
        type: "security",
        text: "Downloads are checked against the published SHA-256 hash and byte size; anything that fails is deleted instead of installed.",
      },
      {
        type: "security",
        text: "Already-downloaded update files are re-verified before install, so a corrupted cache cannot be used.",
      },
      { type: "improvement", text: "Update screen shows a clear 'Verifying SHA-256…' step." },
      {
        type: "improvement",
        text: "Signed with the same certificate as 1.4.1, so existing installs keep their lists, messages and settings.",
      },
    ],
  },
  {
    version: "1.4.1",
    date: "19 November 2026",
    channel: "Android app",
    summary:
      "Stories, Broadcast Channels and live tournament voting shipped alongside the social refresh.",
    changes: [
      {
        type: "feature",
        text: "Stories and Broadcast Channels, including the official ZyniVerse channel.",
      },
      { type: "feature", text: "Tournament voting in live bracket matchups, one vote per matchup." },
      {
        type: "feature",
        text: "Dub Hub with series, movies, full-week schedule, languages and genres.",
      },
      {
        type: "improvement",
        text: "Live TV timings refresh automatically and show TBA when a slot has not been announced.",
      },
      {
        type: "improvement",
        text: "Faster, clearer screens with reliable image fallbacks and a working filler guide.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "November 2026",
    channel: "Android app",
    summary:
      "Stable rollback release with a consolidated Dub Hub and safer update handling.",
    changes: [
      {
        type: "improvement",
        text: "Safe downgrade handling: older builds are only accepted through an explicit rollback.",
      },
      {
        type: "improvement",
        text: "Unified Dub Hub tabs for series, movies, schedule, languages and genres.",
      },
      {
        type: "improvement",
        text: "Stale-first service worker and lighter motion for slower devices.",
      },
    ],
  },
];

const SITE_RELEASES: Release[] = [
  {
    version: "Website · 2026.11",
    date: "19 November 2026",
    channel: "Website",
    summary:
      "Safer 18+ handling, a public release-notes page, a safe watch picker and stronger download transparency.",
    changes: [
      {
        type: "security",
        text: "The 18+ catalogue is age-gated and marked noindex; only metadata is shown and no explicit media is hosted.",
      },
      {
        type: "security",
        text: "Website dependencies upgraded to Next.js 16.4.6 to address the published security advisory.",
      },
      { type: "feature", text: "New public changelog and release-notes page (this page)." },
      {
        type: "feature",
        text: "New anime dice tool for a quick, unbiased pick from your watch options.",
      },
      { type: "improvement", text: "Download page shows the published APK SHA-256 for manual verification." },
      {
        type: "fix",
        text: "Conflicting user-profile route slugs were merged so the production server starts cleanly.",
      },
      { type: "fix", text: "Lint and type errors cleared across the website and Android app." },
    ],
  },
];

function ReleaseCard({ release }: { release: Release }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[var(--color-panel)]/40 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">
          {release.channel === "Android app" ? `App v${release.version}` : release.version}
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-mute)]">
          {release.date}
        </span>
      </header>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-mute)]">{release.summary}</p>
      <ul className="mt-4 space-y-2">
        {release.changes.map((change) => (
          <li key={change.text} className="flex items-start gap-2 text-sm text-[var(--color-mute)]">
            <span
              className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLES[change.type]}`}
            >
              {LABELS[change.type]}
            </span>
            <span className="leading-relaxed">{change.text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function ChangelogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ZyniVerse release notes",
    url: `${BASE_URL}/changelog`,
    numberOfItems: APP_RELEASES.length + SITE_RELEASES.length,
    itemListElement: [...APP_RELEASES, ...SITE_RELEASES].map((release, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name:
          release.channel === "Android app"
            ? `ZyniVerse Android v${release.version}`
            : release.version,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: release.channel === "Android app" ? "Android" : "Web",
        softwareVersion: release.version,
        releaseNotes: release.changes.map((c) => c.text).join(" "),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <header className="mb-10">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--color-cyan)]">
            Release notes
          </p>
          <h1 className="font-display text-3xl font-bold text-[var(--color-ink)] sm:text-4xl">
            ZyniVerse changelog
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-mute)]">
            What changed on the website and in the Android app, newest first. App
            updates install from inside the app; the{" "}
            <Link href="/download" className="text-[var(--color-cyan)] underline decoration-dotted">
              download page
            </Link>{" "}
            always lists the current APK hash.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 font-display text-xl font-bold text-[var(--color-ink)]">
            Android app
          </h2>
          <div className="space-y-4">
            {APP_RELEASES.map((release) => (
              <ReleaseCard key={`app-${release.version}`} release={release} />
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 font-display text-xl font-bold text-[var(--color-ink)]">
            Website
          </h2>
          <div className="space-y-4">
            {SITE_RELEASES.map((release) => (
              <ReleaseCard key={`site-${release.version}`} release={release} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[var(--color-panel)]/30 p-5 text-sm leading-relaxed text-[var(--color-mute)]">
          <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-ink)]">
            Verifying a download
          </h2>
          <p>
            The app verifies every APK automatically. To check a file manually,
            compare its SHA-256 with the hash on the{" "}
            <Link href="/download" className="text-[var(--color-cyan)] underline decoration-dotted">
              download page
            </Link>
            , or read the{" "}
            <Link href="/changelog" className="text-[var(--color-cyan)] underline decoration-dotted">
              release notes
            </Link>{" "}
            for what changed. On Windows:{" "}
            <code className="rounded bg-black/40 px-1 py-0.5 text-[12px]">
              Get-FileHash .\ZyniVerse-{MOBILE_RELEASE.versionName}.apk -Algorithm SHA256
            </code>
          </p>
        </section>
      </main>
    </>
  );
}
