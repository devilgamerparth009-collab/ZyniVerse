/**
 * Official "where to watch" fallbacks for the mobile detail screen.
 *
 * Direct episode/title URLs come from AniList. When AniList has no direct link
 * we only offer searches on official platforms — never third-party or
 * piracy-risk domains — so the app can still point users in the right direction.
 */
export interface StreamingLink {
  platform: string;
  url: string;
  kind: "direct" | "search";
}

const TRUSTED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "crunchyroll.com",
  "www.crunchyroll.com",
  "netflix.com",
  "www.netflix.com",
  "primevideo.com",
  "www.primevideo.com",
  "amazon.com",
  "www.amazon.com",
  "disneyplus.com",
  "www.disneyplus.com",
  "hotstar.com",
  "www.hotstar.com",
  "jiohotstar.com",
  "www.jiohotstar.com",
  "sonyliv.com",
  "www.sonyliv.com",
  "jiocinema.com",
  "www.jiocinema.com",
  "zee5.com",
  "www.zee5.com",
  "mxplayer.in",
  "www.mxplayer.in",
  "tv.apple.com",
  "hidive.com",
  "www.hidive.com",
]);

function isTrustedUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return TRUSTED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function bestTitle(title?: string | null): string {
  return (title || "").trim().slice(0, 120);
}

/** Official platform search pages, used only when there is no direct title URL. */
export function curatedSearchLinks(title?: string | null): StreamingLink[] {
  const q = bestTitle(title);
  if (!q) return [];
  const encoded = encodeURIComponent(q);
  return [
    { platform: "Crunchyroll", url: `https://www.crunchyroll.com/search?q=${encoded}`, kind: "search" },
    { platform: "JioHotstar", url: `https://www.jiohotstar.com/search?q=${encoded}`, kind: "search" },
    { platform: "SonyLIV", url: `https://www.sonyliv.com/search?q=${encoded}`, kind: "search" },
    { platform: "Netflix", url: `https://www.netflix.com/search?q=${encoded}`, kind: "search" },
  ];
}

/** Turn AniList links into a deduplicated, allow-listed set. */
export function directLinksFromAniList(
  links?: { site?: string | null; url: string }[],
  episodes?: { title?: string | null; url: string; site?: string | null }[]
): StreamingLink[] {
  const out: StreamingLink[] = [];
  const seen = new Set<string>();

  const add = (platform: string | null | undefined, url: string, kind: "direct" | "search") => {
    if (!isTrustedUrl(url)) return;
    const clean = new URL(url);
    clean.protocol = "https:";
    const key = clean.toString();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ platform: platform?.trim() || clean.hostname.replace(/^www\./, ""), url: key, kind });
  };

  for (const ep of episodes || []) {
    if (ep?.url) add(ep.site || ep.title || "Watch episode", ep.url, "direct");
  }
  for (const link of links || []) {
    if (link?.url) add(link.site || null, link.url, "direct");
  }
  return out.slice(0, 16);
}
