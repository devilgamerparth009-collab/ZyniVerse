import { unstable_cache } from "next/cache";
import { getDubbedEntries } from "@/lib/editorial";
import DubbedClient from "./DubbedClient";

/**
 * The client still handles language switching, but the first paint is now
 * server-rendered from the same editorial source the API reads. The old page
 * shipped an empty shell and waited for a client fetch before showing anything,
 * which is why /dubbed felt slow on a cold visit.
 */
// 15 minutes: editorial dub pages don't need 5-minute ISR churn.
export const revalidate = 900;

export type LangKey = "english" | "hindi" | "tamil" | "telugu";

export interface DubAnime {
  mal_id: number;
  title: string;
  displayTitle: string;
  image: string;
  synopsis: string;
  genres: string[];
  hasHindi: boolean;
  hasTamil: boolean;
  hasTelugu: boolean;
  hasEnglish: boolean;
  comingSoonLanguages: string[];
  isCurrentSeason: boolean;
  score: string;
}

export interface DubScheduleData {
  available: DubAnime[];
  comingSoon: DubAnime[];
  currentSeason: DubAnime[];
  recent: DubAnime[];
}

export interface DubSchedulePayload {
  data: DubScheduleData;
  counts: Record<string, number>;
  updatedAt: string | null;
}

const getCachedDubSchedule = unstable_cache(
  async (language: string): Promise<DubSchedulePayload> => {
    const { entries, lastUpdated } = await getDubbedEntries();

    const allDubs: DubAnime[] = entries
      .map((d) => ({
        mal_id: d.mal_id,
        title: d.title,
        displayTitle: d.displayTitle,
        image: d.image,
        synopsis: d.synopsis,
        genres: d.genres,
        hasHindi: d.hasHindi,
        hasTamil: d.hasTamil,
        hasTelugu: d.hasTelugu,
        hasEnglish: d.hasEnglish,
        comingSoonLanguages: d.comingSoonLanguages,
        isCurrentSeason: d.isCurrentSeason,
        score: d.score,
      }))
      .filter((item, index, list) => list.findIndex((other) => other.mal_id === item.mal_id) === index);

    let filtered = allDubs;
    if (language === "hindi") filtered = allDubs.filter((d) => d.hasHindi);
    else if (language === "tamil") filtered = allDubs.filter((d) => d.hasTamil);
    else if (language === "telugu") filtered = allDubs.filter((d) => d.hasTelugu);
    else if (language === "english") filtered = allDubs.filter((d) => d.hasEnglish);

    const currentSeason = filtered.filter((d) => d.isCurrentSeason);
    const available = filtered.filter((d) => !d.isCurrentSeason && !d.comingSoonLanguages.length);
    const comingSoon = filtered.filter((d) => d.comingSoonLanguages.length > 0);

    return {
      data: {
        currentSeason,
        // The API still returns `recent`; it is the same set as currentSeason,
        // so keep the field for compatibility but do not render it twice.
        recent: currentSeason,
        available,
        comingSoon,
      },
      counts: {
        total: filtered.length,
        hindi: allDubs.filter((d) => d.hasHindi).length,
        tamil: allDubs.filter((d) => d.hasTamil).length,
        telugu: allDubs.filter((d) => d.hasTelugu).length,
        english: allDubs.filter((d) => d.hasEnglish).length,
        currentSeason: currentSeason.length,
        available: available.length,
        comingSoon: comingSoon.length,
      },
      updatedAt: lastUpdated,
    };
  },
  ["dubbed-schedule-v1"],
  { revalidate: 300, tags: ["dub-schedule"] }
);

export default async function DubbedPage() {
  const initial = await getCachedDubSchedule("hindi");
  return <DubbedClient initialLanguage="hindi" initialPayload={initial} />;
}
