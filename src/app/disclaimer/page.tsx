import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Disclaimer — Content, Sources & Affiliates",
  description:
    "ZyniVerse does not host or stream anime. Read how our metadata is sourced, how third-party links work, and our affiliate disclosure.",
  alternates: { canonical: `${BASE_URL}/disclaimer` },
  robots: { index: true, follow: true },
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">Disclaimer</h1>
      <p className="mt-2 text-sm text-[var(--color-mute)]">Last updated: May 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-[var(--color-mute)]">
        <section>
          <h2 className="font-display text-lg font-semibold text-white">1. We do not host anime</h2>
          <p className="mt-2">
            ZyniVerse is an information and community platform. We do not host, upload, stream, or
            distribute anime, manga, or any copyrighted video content. Every &ldquo;where to
            watch&rdquo; entry links to a licensed platform such as Crunchyroll, Netflix, JioHotstar,
            Prime Video, or YouTube.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">2. Metadata sources</h2>
          <p className="mt-2">
            Titles, synopses, cover images, episode counts and character data are provided by the
            public <span className="text-white">AniList</span> and{" "}
            <span className="text-white">MyAnimeList</span> APIs, plus curated editorial data. They
            are provided &ldquo;as is&rdquo; and may be incomplete, delayed, or inaccurate. We are not
            affiliated with AniList, MyAnimeList, or any studio or publisher.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">3. Streaming availability</h2>
          <p className="mt-2">
            Platform availability, pricing, dubs and subtitles change without notice. A title shown as
            available in India may be removed, geo-restricted, or re-priced by the platform at any
            time. Always confirm on the official platform before subscribing.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">4. Affiliate disclosure</h2>
          <p className="mt-2">
            Some outbound links may be affiliate or referral links. If you sign up through them we may
            earn a small commission at no extra cost to you. This never affects which titles we
            recommend or how we rank them.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">5. User-generated content</h2>
          <p className="mt-2">
            Posts, comments, reels, reviews and wiki edits are created by users and do not represent
            the views of ZyniVerse. We moderate reported content but cannot review everything in
            advance.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">6. No warranty</h2>
          <p className="mt-2">
            The service is provided without warranties of any kind. We are not liable for any loss
            arising from use of the site, including decisions made based on the information shown
            here.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">7. Copyright concerns</h2>
          <p className="mt-2">
            If you believe content on ZyniVerse infringes your rights, please see our{" "}
            <Link href="/dmca" className="text-[var(--color-cyan)] hover:underline">
              DMCA / takedown policy
            </Link>{" "}
            or email{" "}
            <a href="mailto:contact@zyverse.in" className="text-[var(--color-cyan)] hover:underline">
              contact@zyverse.in
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-xs">
        <Link href="/terms" className="text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          Terms of Service
        </Link>
        <Link href="/privacy" className="text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          Privacy Policy
        </Link>
        <Link href="/contact" className="text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          Contact
        </Link>
      </div>
    </div>
  );
}
