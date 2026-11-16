import type { Metadata } from "next";
import Link from "next/link";
import { MOBILE_RELEASE } from "@/lib/mobile-release";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: `Download ZyniVerse ${MOBILE_RELEASE.versionName} for Android`,
  description:
    "Download the latest ZyniVerse Android APK. Anime tracking, filler guides, Hindi dubs, TV guide, manga and community — all in one native app. Updates install from inside the app.",
  alternates: { canonical: `${BASE_URL}/download` },
};

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function DownloadPage() {
  const release = MOBILE_RELEASE;
  const size = formatSize(release.sizeBytes);

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#12121c] via-[#0c0c14] to-[#0a0a0f] p-6 sm:p-10 shadow-[0_20px_80px_-20px_rgba(34,211,238,0.25)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
            Android APK
          </span>
          <span className="rounded-full border border-pink-400/40 bg-pink-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-pink-300">
            v{release.versionName}
          </span>
          {release.mandatory && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-300">
              Required update
            </span>
          )}
        </div>

        <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
          ZyniVerse for Android
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          The full ZyniVerse experience in a native app — anime tracking, filler guides, Hindi
          dubs, the live TV guide, manga, reels and the community. Once installed, every future
          update downloads and installs from inside the app. No Play Store required.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={release.apkUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-pink-400 px-6 py-3 text-sm font-black text-[#08090f] transition hover:brightness-110"
          >
            ⬇ Download APK {size ? `· ${size}` : ""}
          </a>
          <Link
            href="/"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-white/35 hover:text-white"
          >
            Open the website
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">
              What&apos;s new
            </h2>
            <ul className="mt-3 space-y-2">
              {release.notes.map((note) => (
                <li key={note} className="flex gap-2 text-sm leading-relaxed text-slate-400">
                  <span className="text-cyan-300">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">
              How to install
            </h2>
            <ol className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">
              <li>
                <span className="font-bold text-slate-200">1.</span> Tap the download button above.
              </li>
              <li>
                <span className="font-bold text-slate-200">2.</span> If Chrome warns about the
                file, choose <span className="text-slate-200">Download anyway</span> — it is signed
                by ZyniVerse.
              </li>
              <li>
                <span className="font-bold text-slate-200">3.</span> Open the APK and allow
                <span className="text-slate-200"> Install unknown apps</span> for your browser.
              </li>
              <li>
                <span className="font-bold text-slate-200">4.</span> Install over the old version —
                your lists, messages and settings stay intact.
              </li>
            </ol>
          </section>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">
            Already using ZyniVerse?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            You do not need this page. Open the app → <span className="text-slate-200">Settings</span>{" "}
            → <span className="text-slate-200">App update</span>. The app checks for new versions on
            launch, downloads them in the background and installs with one tap.
          </p>
        </div>

        {release.sha256 && (
          <p className="mt-6 break-all text-[11px] text-slate-600">
            SHA-256: {release.sha256}
          </p>
        )}
      </div>
    </main>
  );
}
