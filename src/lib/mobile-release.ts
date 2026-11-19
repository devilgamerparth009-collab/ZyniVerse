/**
 * Single source of truth for the Android release that the in-app updater
 * offers. Bump this block when you publish a new APK; the website is the only
 * thing that has to be redeployed — users do not need to reinstall manually.
 *
 * Everything is overridable through environment variables so a release can be
 * rolled out from Vercel without touching code:
 *
 *   MOBILE_VERSION_NAME=1.4.1
 *   MOBILE_VERSION_CODE=140100
 *   MOBILE_APK_URL=https://.../ZyniVerse-1.4.1.apk
 *   MOBILE_APK_SHA256=...
 *   MOBILE_APK_SIZE=...
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

const FALLBACK_VERSION_NAME = "1.4.1";
const FALLBACK_VERSION_CODE = 140100;

/**
 * Verified metadata for builds we have actually published. Keeping it keyed by
 * version means bumping `MOBILE_VERSION_NAME` without also setting the env vars
 * can never make the app check a new APK against an old hash/size.
 */
const PUBLISHED_BUILDS: Record<string, { sha256: string; sizeBytes: number }> = {
  "1.4.1": {
    sha256: "9cd9f968150352a53febb250f742063d8995c5a05fe0d8881c478bca86c32b6e",
    sizeBytes: 42128273,
  },
  "1.4.0": {
    sha256: "c9178820be0b777850d187abfd5f70ff2e314aec9fa4eeb2a2d7565fc86bddd9",
    sizeBytes: 42093909,
  },
  "1.6.0": {
    sha256: "8b0199df768fa396104133cd789d536ad851296ac33cd223707d4dbc03d6a498",
    sizeBytes: 42052121,
  },
  "1.7.0": {
    sha256: "0346c395508130386b7eaa41e65c3e196cfc835d3642eda30b6f4c61cf592ba7",
    sizeBytes: 42062329,
  },
  "1.8.0": {
    sha256: "4c238f61e449ab161273d10c8a56b72bfba0a94f13373bc58c81f6497369ca11",
    sizeBytes: 42072829,
  },
};

function envNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function websiteAsset(versionName: string): string {
  return `https://zyverse.in/ZyniVerse-${versionName}.apk`;
}

const versionName = process.env.MOBILE_VERSION_NAME || FALLBACK_VERSION_NAME;
const versionCode = envNumber(process.env.MOBILE_VERSION_CODE) || FALLBACK_VERSION_CODE;
const published = PUBLISHED_BUILDS[versionName];

export const MOBILE_RELEASE: MobileRelease = {
  versionName,
  versionCode,
  apkUrl: process.env.MOBILE_APK_URL || websiteAsset(versionName),
  sha256: process.env.MOBILE_APK_SHA256 || published?.sha256,
  sizeBytes: envNumber(process.env.MOBILE_APK_SIZE) || published?.sizeBytes,
  notes: (process.env.MOBILE_RELEASE_NOTES
    ? process.env.MOBILE_RELEASE_NOTES.split("|")
    : [
        "Stories and Broadcast Channels are live, including the official ZyniVerse channel.",
        "Tournament voting now works in live bracket matchups, with one vote per matchup.",
        "Dub Hub: series, movies, full-week schedule, languages and genres in one polished place.",
        "Live TV timings refresh automatically and show TBA when a slot has not been announced.",
        "Faster, clearer screens with reliable image fallbacks and a working filler guide.",
      ]
  ).map((line) => line.trim()).filter(Boolean),
  mandatory: process.env.MOBILE_RELEASE_MANDATORY === "true",
  publishedAt: process.env.MOBILE_RELEASE_PUBLISHED_AT || "2026-11-19T00:00:00.000Z",
  minSupportedVersionCode: envNumber(process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE) || 130000,
};
