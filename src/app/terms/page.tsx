import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "ZyniVerse terms of service: acceptable use, content, intellectual property, disclaimers, and contact information.",
  alternates: { canonical: `${BASE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--color-mute)]">
        <Link href="/" className="hover:text-[var(--color-cyan)] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[var(--color-ink)]">Terms of Service</span>
      </nav>
      <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-[var(--color-mute)]">Last updated: May 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-mute)]">
        <section>
          <h2 className="font-display text-lg font-semibold text-white">1. Acceptance of terms</h2>
          <p className="mt-2">
            By accessing or using ZyniVerse (<a href={BASE_URL} className="text-[var(--color-cyan)] hover:underline">zyverse.in</a>),
            you agree to these Terms of Service and our <Link href="/privacy" className="text-[var(--color-cyan)] hover:underline">Privacy Policy</Link>.
            If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">2. What ZyniVerse provides</h2>
          <p className="mt-2">
            ZyniVerse is an information and community platform for anime and manga fans. We provide guides, schedules, metadata,
            community features, and tools. We do not host, upload, or stream copyrighted anime episodes or manga chapters.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">3. Accounts and security</h2>
          <p className="mt-2">
            You are responsible for your account credentials and activity under your account. Provide accurate information and keep your
            login details secure. We may suspend or terminate accounts that violate these terms or harm the service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">4. User content and acceptable use</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>Post illegal, infringing, harmful, hateful, harassing, or deceptive content.</li>
                        <li>Spam, scrape, crawl, or harvest data abusively; use bots/scripts to bypass rate limits, access controls, or WAF protections; or disrupt the service.</li>
            <li>Access ZyniVerse APIs, data, or content for commercial reuse, redistribution, model training, or mirroring without written permission. Public pages may be viewed by normal users, but automated bulk extraction is not allowed.</li>
            <li>Upload malware, phishing links, or content that violates others&apos; rights.</li>
            <li>Attempt unauthorized access, reverse-engineer protected systems, or impersonate others or misrepresent affiliation.</li>
          </ul>
          <p className="mt-2">
            You retain ownership of content you submit, but you grant ZyniVerse a non-exclusive, worldwide, royalty-free license to host,
            display, and distribute that content as needed to operate and promote the service. You are responsible for having the rights to content you post.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">5. Intellectual property and copyright</h2>
          <p className="mt-2">
            ZyniVerse branding, original site design, and original editorial content are owned by ZyniVerse unless otherwise stated.
            Anime/manga titles, images, and metadata may belong to their respective owners and are used for informational purposes.
            If you believe content infringes your rights, see our <Link href="/dmca" className="text-[var(--color-cyan)] hover:underline">DMCA/Takedown Policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">6. Third-party links and services</h2>
          <p className="mt-2">
            ZyniVerse may link to third-party sites or services. We are not responsible for third-party content, availability, policies, or practices.
            Use them at your own discretion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">7. Disclaimers</h2>
          <p className="mt-2">
            The service is provided “as is” and “as available” without warranties of any kind. We do not guarantee that metadata, schedules,
            availability, or user-generated content will always be accurate, complete, or current.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">8. Limitation of liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, ZyniVerse and its operators are not liable for indirect, incidental, special, consequential,
            or punitive damages, or any loss of data, profits, or goodwill arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">9. Changes to terms</h2>
          <p className="mt-2">
            We may update these terms from time to time. The updated date will be posted on this page. Continued use after changes means you accept the new terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-white">10. Contact</h2>
          <p className="mt-2">
            For terms questions, contact{" "}
            <a href="mailto:contact@zyverse.in" className="text-[var(--color-cyan)] hover:underline">contact@zyverse.in</a>{" "}
            or use our <Link href="/contact" className="text-[var(--color-cyan)] hover:underline">Contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
