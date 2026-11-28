import type { Metadata } from "next";
import Link from "next/link";
import CalendarClient from "@/components/features/CalendarClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";

export const metadata: Metadata = {
  title: "Full Anime Airing Calendar by Month",
  description:
    "Browse every anime episode airing in a month on one calendar. Jump between months and open any title for details.",
  keywords: [
    "anime calendar", "full anime calendar", "anime airing calendar",
    "anime release dates", "monthly anime schedule",
  ],
  alternates: { canonical: `${BASE_URL}/calendar` },
  robots: { index: true, follow: true },
};

export default function CalendarPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-cyan)]">
            📅 Month by month
          </p>
          <h1 className="mt-2 font-display text-3xl font-black sm:text-4xl">
            Full Anime Airing Calendar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-mute)]">
            Every scheduled episode for the selected month. Need the current
            week in IST instead? Open the{" "}
            <Link href="/schedule" className="text-[var(--color-cyan)] hover:underline">
              weekly schedule board
            </Link>
            .
          </p>
        </div>
      </div>
      <CalendarClient />
    </main>
  );
}
