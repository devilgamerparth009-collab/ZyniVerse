import { prisma } from "./prisma";
import { logError } from "./logger";

/**
 * Server-only worldwide box-office sync.
 *
 * Wikipedia's Action API exposes the `gross` field of film infoboxes without an
 * API key. We batch all target titles into ONE request (sequential calls get
 * rate-limited), parse the published figure, and write it back to the
 * editorial record. India grosses stay in the editorial record because no free
 * public API provides per-territory India figures for these releases.
 */
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "ZyniVerseBoxOfficeSync/1.0 (https://zyverse.in)";
const TIMEOUT_MS = 20000;

interface WikiTarget {
  slug: string;
  title: string;
}

export const THEATRICAL_BOX_OFFICE_TARGETS: WikiTarget[] = [
  { slug: "demon-slayer-infinity-castle-india-2025", title: "Demon Slayer: Kimetsu no Yaiba – The Movie: Infinity Castle" },
  { slug: "demon-slayer-mugen-train-india", title: "Demon Slayer: Kimetsu no Yaiba – The Movie: Mugen Train" },
  { slug: "your-name-india", title: "Your Name" },
  { slug: "suzume-india", title: "Suzume" },
  { slug: "boy-and-the-heron-india-2024", title: "The Boy and the Heron" },
  { slug: "one-piece-film-red-india", title: "One Piece Film: Red" },
  { slug: "weathering-with-you-india", title: "Weathering with You" },
  { slug: "chainsaw-man-reze-arc-india-2025", title: "Chainsaw Man – The Movie: Reze Arc" },
  { slug: "jujutsu-kaisen-0-india", title: "Jujutsu Kaisen 0 (film)" },
  { slug: "haikyu-dumpster-battle-india-2024", title: "Haikyu!! The Dumpster Battle" },
];

interface WikiPage {
  title: string;
  missing?: boolean;
  revisions?: Array<{
    slots?: { main?: { content?: string } };
  }>;
}

interface WikiResponse {
  error?: { info?: string };
  query?: {
    redirects?: Array<{ from: string; to: string }>;
    pages?: WikiPage[];
  };
}

/** Turn a raw infobox `gross` value into a clean, user-facing figure. */
export function normalizeWikipediaGross(raw: string): string | null {
  const cleaned = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/\{\{\s*(?:US\$?|USD|nbsp)\s*(?:\|([^}]*))?\}\}/gi, (_, inner: string | undefined) =>
      inner === undefined ? " " : `$${inner}`
    )
    .replace(/\{\{\s*nowrap\s*\|\s*([^}]+)\}\}/gi, "$1")
    .replace(/&nbsp;|&#160;|&thinsp;/gi, " ")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/''+/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/\$\s*([\d,.]+)\s*(million|billion|m|b)?/i);
  if (!match) return null;

  const amount = match[1].replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(amount)) return null;

  const unitToken = (match[2] ?? "").toLowerCase();
  const unit = unitToken === "m" ? "million" : unitToken === "b" ? "billion" : unitToken;
  return `$${amount}${unit ? ` ${unit}` : ""}`;
}

export interface BoxOfficeSyncResult {
  checked: number;
  matched: number;
  updated: number;
  results: Array<{
    slug: string;
    status: "updated" | "unchanged" | "no-figure" | "missing-row";
    figure?: string;
  }>;
  error?: string;
}

export async function syncTheatricalBoxOffice(): Promise<BoxOfficeSyncResult> {
  const result: BoxOfficeSyncResult = { checked: 0, matched: 0, updated: 0, results: [] };
  const figures = new Map<string, string>();

  try {
    const titles = THEATRICAL_BOX_OFFICE_TARGETS.map((target) => target.title);
    const url = `${WIKI_API}?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Wikipedia responded with ${res.status}`);

    const json: WikiResponse = await res.json();
    if (json.error?.info) throw new Error(json.error.info);

    const redirects = new Map((json.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((json.query?.pages ?? []).map((page) => [page.title, page]));

    for (const target of THEATRICAL_BOX_OFFICE_TARGETS) {
      const resolvedTitle = redirects.get(target.title) ?? target.title;
      const page = pages.get(resolvedTitle);
      if (!page || page.missing) continue;

      const content = page.revisions?.[0]?.slots?.main?.content ?? "";
      const raw = content.match(/^\s*\|\s*gross\s*=\s*(.+)$/im)?.[1];
      const figure = raw ? normalizeWikipediaGross(raw) : null;
      if (figure) figures.set(target.slug, figure);
    }
  } catch (error) {
    logError(error, "theatrical-boxoffice");
    return { ...result, error: error instanceof Error ? error.message : String(error) };
  }

  result.matched = figures.size;
  const rows = await prisma.editorialEntry.findMany({
    where: { kind: "theatrical", slug: { in: THEATRICAL_BOX_OFFICE_TARGETS.map((t) => t.slug) } },
    select: { id: true, slug: true, data: true },
  });
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));

  for (const target of THEATRICAL_BOX_OFFICE_TARGETS) {
    result.checked += 1;
    const figure = figures.get(target.slug);
    if (!figure) {
      result.results.push({ slug: target.slug, status: "no-figure" });
      continue;
    }

    const row = rowBySlug.get(target.slug);
    if (!row) {
      result.results.push({ slug: target.slug, status: "missing-row", figure });
      continue;
    }

    const data =
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {};
    const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(target.title.replace(/ /g, "_"))}`;
    const changed =
      data.boxOfficeWorldwide !== figure ||
      data.boxOfficeSource !== "Wikipedia" ||
      data.wikipediaUrl !== wikipediaUrl;

    if (changed) {
      await prisma.editorialEntry.update({
        where: { id: row.id },
        data: {
          data: JSON.parse(
            JSON.stringify({
              ...data,
              boxOfficeWorldwide: figure,
              boxOfficeSource: "Wikipedia",
              wikipediaUrl,
            })
          ),
        },
      });
      result.updated += 1;
      result.results.push({ slug: target.slug, status: "updated", figure });
    } else {
      result.results.push({ slug: target.slug, status: "unchanged", figure });
    }
  }

  return result;
}
