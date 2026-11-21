import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "DMCA & Copyright Takedown Policy",
  description:
    "How to submit a copyright takedown notice to ZyniVerse, what information to include, and how counter-notices are handled.",
  alternates: { canonical: `${BASE_URL}/dmca` },
  robots: { index: true, follow: true },
};

export default function DmcaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        DMCA &amp; Copyright Takedown Policy
      </h1>
      <p className="mt-2 text-sm text-[var(--color-mute)]">Last updated: May 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-[var(--color-mute)]">
        <section>
          <h2 className="font-display text-lg font-semibold text-white">Our position</h2>
          <p className="mt-2">
            ZyniVerse does not host or stream anime episodes, films, or manga chapters. The site
            publishes metadata, editorial guides, and community posts, and links out to licensed
            platforms. If a user has nonetheless uploaded material that infringes your copyright, we
            will remove it promptly once notified.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">How to file a notice</h2>
          <p className="mt-2">
            Send an email to{" "}
            <a href="mailto:contact@zyverse.in" className="text-[var(--color-cyan)] hover:underline">
              contact@zyverse.in
            </a>{" "}
            with the subject line <span className="text-white">&ldquo;DMCA Takedown&rdquo;</span> and
            include all of the following:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Identification of the copyrighted work you own (title, registration number if any, or a
              link to the original).
            </li>
            <li>
              The exact URL(s) on zyverse.in where the allegedly infringing material appears. General
              site links are not enough — we need the specific page.
            </li>
            <li>Your full name, postal address, telephone number, and email address.</li>
            <li>
              A statement that you have a good-faith belief the use is not authorised by the copyright
              owner, its agent, or the law.
            </li>
            <li>
              A statement, under penalty of perjury, that the information in your notice is accurate
              and that you are the copyright owner or authorised to act on their behalf.
            </li>
            <li>Your physical or electronic signature.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">What happens next</h2>
          <p className="mt-2">
            We aim to review complete notices within <span className="text-white">72 hours</span>.
            Valid notices result in the content being removed or disabled, and the uploader being
            notified where possible. Incomplete notices may be returned for clarification, which
            restarts the clock.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">Counter-notice</h2>
          <p className="mt-2">
            If your content was removed and you believe it was a mistake or misidentification, you may
            send a counter-notice to the same address including your contact details, identification
            of the removed material and its previous location, a statement under penalty of perjury
            that the removal was a mistake, and your consent to the jurisdiction of the appropriate
            court.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">Repeat infringers</h2>
          <p className="mt-2">
            Accounts that repeatedly upload infringing material are suspended. This applies to posts,
            reels, wallpapers, cosplay uploads, and wiki media alike.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">Misuse</h2>
          <p className="mt-2">
            Knowingly submitting a false takedown notice may expose you to liability under applicable
            law. Please make sure you actually own the rights before filing.
          </p>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-xs">
        <Link href="/terms" className="text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          Terms of Service
        </Link>
        <Link href="/disclaimer" className="text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          Disclaimer
        </Link>
        <Link href="/contact" className="text-[var(--color-mute)] transition-colors hover:text-[var(--color-cyan)]">
          Contact
        </Link>
      </div>
    </div>
  );
}
