import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "ZyniVerse privacy policy: what data we collect, how we use it, cookies, advertising partners, and your choices.",
  alternates: { canonical: `${BASE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/" className="hover:text-[var(--color-cyan)] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">Privacy Policy</span>
      </nav>
      <h1 className="font-display text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[var(--color-mute)]">Last updated: May 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-mute)]">
        <section>
          <h2 className="font-display text-lg font-semibold text-white">1. Who we are</h2>
          <p className="mt-2">
            ZyniVerse (<a href={BASE_URL} className="text-[var(--color-cyan)] hover:underline">zyverse.in</a>)
            is an anime and manga information platform. It provides filler guides, watch orders, schedules,
            community features, and related tools. For privacy questions or requests, contact us at{" "}
            <a href="mailto:contact@zyverse.in" className="text-[var(--color-cyan)] hover:underline">contact@zyverse.in</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">2. Information we collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li><span className="text-white">Account data:</span> email address, username, password hash, and profile details you choose to provide.</li>
            <li><span className="text-white">User content:</span> watchlist entries, reviews, comments, posts, and other content you submit.</li>
            <li><span className="text-white">Usage data:</span> pages viewed, device/browser information, approximate location/country, IP address, and interaction events needed to operate and secure the service.</li>
            <li><span className="text-white">Cookie data:</span> essential cookies for login/session, and optional analytics/advertising cookies depending on your choices and enabled services.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">3. How we use information</h2>
          <p className="mt-2">We use information to:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Provide, maintain, and secure ZyniVerse accounts and features.</li>
            <li>Save your watchlist, preferences, and community activity.</li>
            <li>Respond to support, feedback, and legal requests.</li>
            <li>Understand site performance and improve content quality.</li>
            <li>Prevent abuse, spam, fraud, and unauthorized access.</li>
            <li>Show ads where enabled, and measure ad performance in accordance with applicable consent choices.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">4. Cookies and advertising</h2>
          <p className="mt-2">
            We use essential cookies for authentication, security, and core site functionality. We may also
            use analytics and advertising cookies or similar technologies.
          </p>
          <p className="mt-2">
            Third-party vendors, including Google, may use cookies to serve ads based on a user’s prior visits
            to this website or other websites. Google’s use of advertising cookies enables it and its partners
            to serve ads based on your visit to ZyniVerse and/or other sites on the Internet. You can opt out of
            personalized advertising by visiting{" "}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cyan)] hover:underline">Google Ads Settings</a>{" "}
            and{" "}
            <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-cyan)] hover:underline">aboutads.info</a>.
          </p>
          <p className="mt-2">
            We may also work with other ad partners (such as Adsterra) to display ads. These partners may collect
            or receive information through cookies, web beacons, or similar technologies subject to their own policies.
            You can manage non-essential cookies through our cookie banner where available.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">5. Third-party services</h2>
          <p className="mt-2">
            ZyniVerse uses third-party services to operate. These may include hosting/infrastructure providers (such as Vercel),
            authentication providers, analytics tools, ad networks, and data sources such as AniList for anime/manga metadata.
            These providers may process data according to their own privacy policies.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">6. Data sharing</h2>
          <p className="mt-2">
            We do not sell your personal information. We may share information with service providers who help operate the site,
            when required by law, to protect rights and safety, or as part of a business transfer. Public content you post
            (such as comments or public profile information) may be visible to others.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">7. Data retention and security</h2>
          <p className="mt-2">
            We keep personal data only as long as needed for the purposes described above, unless a longer period is required by law.
            We use reasonable technical and organizational measures to protect data, but no online system can be guaranteed 100% secure.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">8. Your choices and rights</h2>
          <p className="mt-2">
            Depending on your location, you may have rights to access, correct, delete, or object to certain processing of your personal data.
            You can update profile information in your account settings where available. For privacy requests, email{" "}
            <a href="mailto:contact@zyverse.in" className="text-[var(--color-cyan)] hover:underline">contact@zyverse.in</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">9. Children’s privacy</h2>
          <p className="mt-2">
            ZyniVerse is not intended for children under 13. If you believe a child has provided personal information, contact us and we will take appropriate steps.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">10. Changes to this policy</h2>
          <p className="mt-2">
            We may update this policy from time to time. The “Last updated” date at the top of this page will change when we do.
            Continued use of ZyniVerse after changes means you accept the updated policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">11. Contact</h2>
          <p className="mt-2">
            For privacy questions, contact:{" "}
            <a href="mailto:contact@zyverse.in" className="text-[var(--color-cyan)] hover:underline">contact@zyverse.in</a>.
            You can also visit our <Link href="/contact" className="text-[var(--color-cyan)] hover:underline">Contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
