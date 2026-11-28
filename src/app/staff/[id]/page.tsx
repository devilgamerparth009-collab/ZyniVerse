import { cache } from "react";
import { notFound } from "next/navigation";
import { getStaffBasic, getStaffMedia, AniListUnavailableError } from "@/lib/anilist";
import StaffDetailClient from "./staff-client";
import AnimeUnavailableCard from "@/components/AnimeUnavailableCard";

// Noindex/disallowed AniList mirror. Dynamic rendering + no-store data fetches
// stop one ISR entry and two data-cache entries per crawled staff id; the CDN
// caches the rendered response instead.
export const dynamic = "force-dynamic";

const getStaffBasicCached = cache((id: string) => getStaffBasic(id, { noStore: true }));
const getStaffMediaCached = cache((id: string) => getStaffMedia(id, 50, { noStore: true }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return { title: "Staff", robots: { index: false, follow: false } };
  }
  try {
    const staff = await getStaffBasicCached(id);
    const name = staff.name?.full || "Staff";
    const description = (staff.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    return {
      title: `${name} — Staff`,
      description: description || `Anime works, roles and details for ${name}.`,
      robots: { index: false, follow: false },
      openGraph: {
        title: `${name} — Staff`,
        description,
        images: staff.image?.large ? [{ url: staff.image.large, alt: name }] : undefined,
      },
    };
  } catch {
    return { title: "Staff", robots: { index: false, follow: false } };
  }
}

export default async function StaffDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  let staff;
  try {
    staff = await getStaffBasicCached(id);
  } catch (err) {
    if (err instanceof AniListUnavailableError) {
      return <AnimeUnavailableCard href={`/staff/${id}`} />;
    }
    notFound();
  }
  if (!staff) notFound();
  const mediaEdges = await getStaffMediaCached(id).catch(() => undefined);
  return <StaffDetailClient initialStaff={staff} initialEdges={mediaEdges} />;
}
