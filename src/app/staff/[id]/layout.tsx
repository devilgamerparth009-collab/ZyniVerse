import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://zyverse.in";
  return {
    title: `Staff Profile`,
    description: `View anime/manga staff profile, works, and career details on ZyniVerse.`,
    alternates: { canonical: `${baseUrl}/staff/${id}` },
    // Thin AniList mirror (name + filmography). No unique content; match the
    // noindex/nofollow HTTP header applied to these mirrored detail pages.
    robots: { index: false, follow: false },
  };
}

export default function StaffDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
