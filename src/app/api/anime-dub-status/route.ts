import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
export const dynamic = "force-dynamic";

const ANITALY_BASE = "https://anitally.in/api";
const ANIDUB_BASE = "https://api.anidub.moe/v1/anime";
const ANIMEDUBHINDI_API = "https://www.animedubhindi.link/wp-json/wp/v2/posts";
const MYDUBLIST_BASE =
  "https://raw.githubusercontent.com/Joelis57/MyDubList/main/dubs/confidence";

/** BCP-47 codes used by anidub.moe → labels shown in the UI. */
const DUB_LANGUAGE_CODES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  bn: "Bengali",
};

/** Languages parsed from animedubhindi.link multi-audio post titles. */
const SITE_LANGUAGE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "English", pattern: /\bEnglish\b/i },
  { label: "Hindi", pattern: /\bHindi\b/i },
  { label: "Tamil", pattern: /\bTamil\b/i },
  { label: "Telugu", pattern: /\bTelugu\b/i },
  { label: "Malayalam", pattern: /\bMalayalam\b/i },
  { label: "Bengali", pattern: /\bBengali\b|\bBangla\b/i },
];

interface RegionalDubEntry {
  mal_id: number;
  has_hindi: boolean;
  has_tamil: boolean;
  has_telugu: boolean;
  is_current_season_dub: number;
  coming_soon_languages: string | null;
}

interface AnidubDub {
  language: string;
  status: "dubbed" | "in_production" | "announced" | "none" | "unknown";
}

interface WpPost {
  title?: { rendered?: string };
}

type Confidence = "normal" | "high";
type DubLanguage = "english" | "hindi";

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function normalizeTitle(title: string): string {
  return decodeHtml(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** "2nd Season" and "Season 2" both resolve to 2 so seasons don't cross-match. */
function seasonNumber(title: string): number | null {
  const normalized = normalizeTitle(title);
  const seasonFirst = normalized.match(/\bseason\s+(\d+)\b/);
  if (seasonFirst) return Number(seasonFirst[1]);
  const ordinalFirst = normalized.match(/\b(\d+)\s+(?:st|nd|rd|th)\s+season\b/);
  return ordinalFirst ? Number(ordinalFirst[1]) : null;
}

function titlesMatch(candidate: string, postTitle: string): boolean {
  const needle = normalizeTitle(candidate);
  const haystack = normalizeTitle(postTitle);
  // Short/ambiguous titles ("86", "Hyouka") would match too much on this index.
  if (needle.length < 6) return false;
  if (!haystack.includes(needle)) return false;

  const candidateSeason = seasonNumber(candidate);
  const postSeason = seasonNumber(postTitle);
  if (candidateSeason !== null || postSeason !== null) {
    return candidateSeason !== null && candidateSeason === postSeason;
  }
  return true;
}

async function loadMyDubListIds(
  confidence: Confidence,
  language: DubLanguage,
): Promise<Set<number>> {
  try {
    const res = await fetch(
      `${MYDUBLIST_BASE}/${confidence}/dubbed_${language}.json`,
      {
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) return new Set<number>();
    const data = (await res.json()) as { dubbed?: number[] };
    return new Set<number>(Array.isArray(data.dubbed) ? data.dubbed : []);
  } catch {
    return new Set<number>();
  }
}

async function loadRegionalDubs(): Promise<RegionalDubEntry[] | null> {
  try {
    const res = await fetch(`${ANITALY_BASE}/regional-dubs`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: RegionalDubEntry[] };
    return Array.isArray(data.data) ? data.data : null;
  } catch {
    return null;
  }
}

/** anidub.moe is keyed by AniList id and reports per-language dub status. */
async function loadAnidubDubs(anilistId: number | null): Promise<AnidubDub[]> {
  if (!anilistId) return [];
  try {
    const res = await fetch(`${ANIDUB_BASE}/${anilistId}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { dubs?: AnidubDub[] };
    return Array.isArray(data.dubs) ? data.dubs : [];
  } catch {
    return [];
  }
}

/**
 * animedubhindi.link lists available audio tracks directly in multi-audio post
 * titles (Hindi, Tamil, Telugu, Malayalam, Bangla, English...). We only read the
 * title metadata — no download links are used or stored.
 */
async function loadAnimedubhindiDubs(titles: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (titles.length === 0) return found;

  const results = await Promise.allSettled(
    titles.slice(0, 3).map(async (title) => {
      const url = `${ANIMEDUBHINDI_API}?search=${encodeURIComponent(title)}&per_page=8&_fields=title`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) return [] as WpPost[];
      return (await res.json()) as WpPost[];
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const post of result.value) {
      const rendered = post.title?.rendered;
      if (!rendered) continue;
      const decoded = decodeHtml(rendered);
      if (!titles.some((candidate) => titlesMatch(candidate, decoded))) continue;
      for (const { label, pattern } of SITE_LANGUAGE_PATTERNS) {
        if (pattern.test(decoded)) found.add(label);
      }
    }
  }
  return found;
}

async function GET_inner(request: Request) {
  const { searchParams } = new URL(request.url);
  const malId = searchParams.get("malId");
  const anilistParam = searchParams.get("anilistId");
  const titlesParam = searchParams.get("titles");

  if (!malId) {
    return NextResponse.json({ success: false, error: "malId required" }, { status: 400 });
  }

  const malIdNum = Number.parseInt(malId, 10);
  if (!Number.isFinite(malIdNum)) {
    return NextResponse.json({ success: false, error: "invalid malId" }, { status: 400 });
  }

  const parsedAnilist = anilistParam ? Number.parseInt(anilistParam, 10) : NaN;
  const anilistId = Number.isFinite(parsedAnilist) ? parsedAnilist : null;

  const titles = (titlesParam ?? "")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  try {
    const [regional, englishNormal, englishHigh, hindiNormal, hindiHigh, anidubDubs, siteDubs] =
      await Promise.all([
        loadRegionalDubs(),
        loadMyDubListIds("normal", "english"),
        loadMyDubListIds("high", "english"),
        loadMyDubListIds("normal", "hindi"),
        loadMyDubListIds("high", "hindi"),
        loadAnidubDubs(anilistId),
        loadAnimedubhindiDubs(titles),
      ]);

    const myDubListEnglish = englishNormal.has(malIdNum) || englishHigh.has(malIdNum);
    const myDubListHindi = hindiNormal.has(malIdNum) || hindiHigh.has(malIdNum);

    const verifiedByAnidub = new Set<string>();
    const productionByAnidub = new Set<string>();
    for (const dub of anidubDubs) {
      const label = DUB_LANGUAGE_CODES[dub.language];
      if (!label) continue;
      if (dub.status === "dubbed") verifiedByAnidub.add(label);
      if (dub.status === "in_production" || dub.status === "announced") {
        productionByAnidub.add(label);
      }
    }

    const match = regional?.find((item) => item.mal_id === malIdNum) ?? null;
    const regionalComingSoon = (match?.coming_soon_languages ?? "")
      .split(",")
      .map((lang) => lang.trim())
      .filter(Boolean);

    const hasEnglish = myDubListEnglish || verifiedByAnidub.has("English") || siteDubs.has("English");
    const hasHindi =
      myDubListHindi ||
      verifiedByAnidub.has("Hindi") ||
      siteDubs.has("Hindi") ||
      match?.has_hindi === true;
    const hasTamil =
      verifiedByAnidub.has("Tamil") || siteDubs.has("Tamil") || match?.has_tamil === true;
    const hasTelugu =
      verifiedByAnidub.has("Telugu") || siteDubs.has("Telugu") || match?.has_telugu === true;
    const hasMalayalam = verifiedByAnidub.has("Malayalam") || siteDubs.has("Malayalam");
    const hasBengali = verifiedByAnidub.has("Bengali") || siteDubs.has("Bengali");

    const available: string[] = [];
    if (hasEnglish) available.push("English");
    if (hasHindi) available.push("Hindi");
    if (hasTamil) available.push("Tamil");
    if (hasTelugu) available.push("Telugu");
    if (hasMalayalam) available.push("Malayalam");
    if (hasBengali) available.push("Bengali");

    // "Coming soon"/"in production" is never shown as an available dub chip.
    const pendingLabels = [...productionByAnidub, ...regionalComingSoon];
    const comingSoonLanguages = pendingLabels.filter(
      (lang, index) =>
        pendingLabels.indexOf(lang) === index &&
        !available.some((a) => a.toLowerCase() === lang.toLowerCase()),
    );

    return NextResponse.json({
      success: true,
      available,
      details: {
        hasEnglish,
        hasHindi,
        hasTamil,
        hasTelugu,
        hasMalayalam,
        hasBengali,
        isCurrentSeason: match?.is_current_season_dub === 1,
        comingSoonLanguages,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to check dub status" }, { status: 500 });
  }
}

export async function GET(...args: Parameters<typeof GET_inner>) {
  const res = await GET_inner(...args);
  return withPublicCache(res);
}
