const AVATAR_PROXY_HOSTS = [
  "googleusercontent.com",
  "supabase.co",
  "githubusercontent.com",
  "discordapp.com",
  "discord.com",
  "ui-avatars.com",
  "gravatar.com",
  "anilist.co",
  "anili.st",
  "myanimelist.net",
  "wikimedia.org",
  "wikipedia.org",
  "placewaifu.com",
];

export function isAllowedAvatarHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return AVATAR_PROXY_HOSTS.some((allowed) => h === allowed || h.endsWith("." + allowed));
}

export function proxyImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !isAllowedAvatarHost(u.hostname)) return url;
    return `/api/avatar?url=${encodeURIComponent(u.toString())}`;
  } catch {
    return url;
  }
}

const SITE_ORIGIN = "https://zyverse.in";

/** Absolute upstream URL without going through the site image proxy. */
export function directImageUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  let raw = url.trim();
  if (!raw) return null;
  if (raw.startsWith("//")) raw = `https:${raw}`;
  if (/^http:\/\//i.test(raw)) raw = `https://${raw.slice("http://".length)}`;
  if (raw.startsWith("/")) return `${SITE_ORIGIN}${raw}`;
  // Tolerate CDN URLs pasted without a scheme (old mediaImageUrl behaviour).
  if (
    !/^https?:\/\//i.test(raw) &&
    /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#]|$)/i.test(raw)
  ) {
    raw = `https://${raw}`;
  }
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

/** Site proxy URL, absolute, for a known upstream host. */
export function proxyImageAbsoluteUrl(url: string | null | undefined): string | null {
  const proxied = proxyImageUrl(url);
  if (typeof proxied !== "string" || !proxied) return null;
  return proxied.startsWith("/") ? `${SITE_ORIGIN}${proxied}` : proxied;
}

/**
 * Artwork is loaded straight from its original host. No website proxy hop:
 * if the host fails, the caller shows a local branded placeholder instead.
 */
export function imageCandidates(url: string | null | undefined): string[] {
  // Server payloads sometimes arrive already proxied. Unwrap them so the phone
  // loads the original CDN URL directly.
  const direct = directImageUrl(unproxyImageUrl(url));
  return direct ? [direct] : [];
}

export function unproxyImageUrl(url: string | null | undefined): string | null | undefined {
  if (typeof url !== "string") return url;
  const marker = "/api/avatar?url=";
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    try {
      return decodeURIComponent(url.slice(idx + marker.length));
    } catch {
      return url;
    }
  }
  return url;
}
