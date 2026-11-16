/**
 * Single source of truth for the Android release that the in-app updater
 * offers. Bump this block when you publish a new APK; the website is the only
 * thing that has to be redeployed — users do not need to reinstall manually.
 *
 * Everything is overridable through environment variables so a release can be
 * rolled out from Vercel without touching code:
 *
 *   MOBILE_VERSION_NAME=1.6.1
 *   MOBILE_VERSION_CODE=160001
 *   MOBILE_APK_URL=https://.../ZyniVerse-1.6.1.apk
 *   MOBILE_APK_SHA256=...
 *   MOBILE_APK_SIZE=41663245
 *   MOBILE_RELEASE_NOTES=One|Two|Three
 *   MOBILE_RELEASE_MANDATORY=true
 */
export interface MobileRelease {
  versionName: string;
  versionCode: number;
  /** Direct download URL (GitHub release asset, CDN, …). */
  apkUrl: string;
  /** Optional SHA-256 of the APK; the app verifies it after download. */
  sha256?: string;
  sizeBytes?: number;
  /** Short bullet list shown in the native update screen. */
  notes: string[];
  mandatory: boolean;
  publishedAt: string;
  /** Oldest build that can still open the app; below this the update is forced. */
  minSupportedVersionCode: number;
}

const FALLBACK_VERSION_NAME = "1.6.0";
const FALLBACK_VERSION_CODE = 160000;

/**
 * Verified metadata for builds we have actually published. Keeping it keyed by
 * version means bumping `MOBILE_VERSION_NAME` without also setting the env vars
 * can never make the app check a new APK against an old hash/size.
 */
const PUBLISHED_BUILDS: Record<string, { sha256: string; sizeBytes: number }> = {
  "1.6.0": {
    sha256: "8b0199df768fa396104133cd789d536ad851296ac33cd223707d4dbc03d6a498",
    sizeBytes: 42052121,
  },
};

function envNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function githubAsset(versionName: string): string {
  return `https://github.com/ParthGupta062/ZyniVerse/releases/download/v${versionName}/ZyniVerse-${versionName}.apk`;
}

const versionName = process.env.MOBILE_VERSION_NAME || FALLBACK_VERSION_NAME;
const versionCode = envNumber(process.env.MOBILE_VERSION_CODE) || FALLBACK_VERSION_CODE;
const published = PUBLISHED_BUILDS[versionName];

export const MOBILE_RELEASE: MobileRelease = {
  versionName,
  versionCode,
  apkUrl: process.env.MOBILE_APK_URL || githubAsset(versionName),
  sha256: process.env.MOBILE_APK_SHA256 || published?.sha256,
  sizeBytes: envNumber(process.env.MOBILE_APK_SIZE) || published?.sizeBytes,
  notes: (process.env.MOBILE_RELEASE_NOTES
    ? process.env.MOBILE_RELEASE_NOTES.split("|")
    : [
        "Brand-new in-app updater — future versions install without a browser.",
        "TV & Streaming: every channel logo now ships with the app.",
        "Profile: fixed session errors, website avatar sync and default avatar.",
        "Edit Profile: avatar picker previews instantly + sticky Save button.",
        "Native Messages, Friends, Clubs and Community screens (no WebView).",
        "Instant content updates from the server — new announcements appear without an APK update.",
      ]
  ).map((line) => line.trim()).filter(Boolean),
  mandatory: process.env.MOBILE_RELEASE_MANDATORY === "true",
  publishedAt: process.env.MOBILE_RELEASE_PUBLISHED_AT || "2026-11-16T00:00:00.000Z",
  minSupportedVersionCode: envNumber(process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE) || 140020,
};
