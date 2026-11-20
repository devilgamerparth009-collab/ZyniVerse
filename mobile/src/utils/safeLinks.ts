import { Linking } from 'react-native';
import { navigationRef } from '../navigation/navigationRef';

/**
 * User-facing web destinations in the app stay on ZyniVerse's own origin by
 * default. Only explicitly trusted official platform URLs (e.g. Crunchyroll,
 * YouTube, Netflix) may be opened externally when the UI intentionally links
 * to "where to watch". Unknown, shortlink, forum, or piracy-risk domains are
 * never opened from a tap target.
 */
export const SAFE_WEB_ORIGIN = 'https://zyverse.in';

const TRUSTED_PLATFORM_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'crunchyroll.com',
  'www.crunchyroll.com',
  'netflix.com',
  'www.netflix.com',
  'primevideo.com',
  'www.primevideo.com',
  'amazon.com',
  'www.amazon.com',
  'disneyplus.com',
  'www.disneyplus.com',
  'hotstar.com',
  'www.hotstar.com',
  'jiohotstar.com',
  'www.jiohotstar.com',
  'sonyliv.com',
  'www.sonyliv.com',
  'jiocinema.com',
  'www.jiocinema.com',
  'zee5.com',
  'www.zee5.com',
  'mxplayer.in',
  'www.mxplayer.in',
  'tv.apple.com',
  'animelab.com',
  'www.animelab.com',
  'hidive.com',
  'www.hidive.com',
  'bilibili.tv',
  'www.bilibili.tv',
  'abema.tv',
  'dazn.com',
  'www.dazn.com',
]);

function isSameOrigin(value: string): boolean {
  try {
    const parsed = new URL(value, SAFE_WEB_ORIGIN);
    return parsed.protocol === 'https:' && parsed.hostname === 'zyverse.in';
  } catch {
    return /^https:\/\/zyverse\.in(?:\/|$)/i.test(value);
  }
}

function normalizeHttpUrl(value?: string | null): URL | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True only for known official streaming/platform domains. */
export function isTrustedPlatformUrl(value?: string | null): boolean {
  const parsed = normalizeHttpUrl(value);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (TRUSTED_PLATFORM_HOSTS.has(host)) {
    // amazon.com is allowed only for Prime Video watch pages.
    if (host === 'amazon.com' || host === 'www.amazon.com') {
      return /^\/(?:gp\/video|dp)\b/i.test(parsed.pathname);
    }
    return true;
  }
  return false;
}

/** Return a trusted external platform URL, or null when not allowed. */
export function trustedExternalUrl(value?: string | null): string | null {
  const parsed = normalizeHttpUrl(value);
  if (!parsed || !isTrustedPlatformUrl(parsed.toString())) return null;
  // Always open over https for trusted platforms.
  parsed.protocol = 'https:';
  return parsed.toString();
}

export function platformLabelForUrl(value?: string | null): string {
  const parsed = normalizeHttpUrl(value);
  if (!parsed) return 'Watch';
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be' || host.includes('youtube')) return 'YouTube';
  if (host.includes('crunchyroll')) return 'Crunchyroll';
  if (host.includes('netflix')) return 'Netflix';
  if (host.includes('primevideo') || host.includes('amazon.com')) return 'Prime Video';
  if (host.includes('disneyplus')) return 'Disney+';
  if (host.includes('jiohotstar') || host.includes('hotstar')) return 'JioHotstar';
  if (host.includes('sonyliv')) return 'SonyLIV';
  if (host.includes('jiocinema')) return 'JioCinema';
  if (host.includes('zee5')) return 'ZEE5';
  if (host.includes('mxplayer')) return 'MX Player';
  if (host.includes('hidive')) return 'HIDIVE';
  if (host.includes('bilibili')) return 'Bilibili';
  if (host.includes('abema')) return 'ABEMA';
  if (host.includes('apple')) return 'Apple TV';
  return parsed.hostname.replace(/^www\./, '');
}

/** Open a trusted official platform URL in the system browser/app. */
export async function openTrustedExternalUrl(value?: string | null): Promise<boolean> {
  const url = trustedExternalUrl(value);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Return a safe same-origin path, mapping any foreign URL to `fallback`. */
export function internalPath(value?: string | null, fallback = '/'): string {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? fallback : trimmed;
  }
  if (isSameOrigin(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.pathname || '/'}${parsed.search}${parsed.hash}` || fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Full https://zyverse.in URL for a path or untrusted URL. */
export function safeWebUrl(value?: string | null, fallback = '/'): string {
  return `${SAFE_WEB_ORIGIN}${internalPath(value, fallback)}`;
}

/** Open a ZyniVerse page in-app, or a trusted official platform URL externally. */
export function openSafeWebUrl(value?: string | null, fallback = '/'): void {
  const trusted = trustedExternalUrl(value);
  if (trusted) {
    Linking.openURL(trusted).catch(() => {});
    return;
  }
  const path = internalPath(value, fallback);
  if (navigationRef.isReady()) {
    try {
      navigationRef.navigate('Web', { path });
      return;
    } catch {
      // fall through to browser
    }
  }
  Linking.openURL(safeWebUrl(path, fallback)).catch(() => {});
}

/** WebView navigation guard: block anything that leaves our own origin. */
export function canLoadInAppWebView(url: string): boolean {
  return isSameOrigin(url);
}
