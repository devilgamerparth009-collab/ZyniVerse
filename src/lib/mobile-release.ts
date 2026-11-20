/**
 * Single source of truth for the Android release that the in-app updater
 * offers. Bump this block when you publish a new APK; the website is the only
 * thing that has to be redeployed — users do not need to reinstall manually.
 *
 * Everything is overridable through environment variables so a release can be
 * rolled out from Vercel without touching code:
 *
 *   MOBILE_VERSION_NAME=1.4.3
 *   MOBILE_VERSION_CODE=140300
 *   MOBILE_APK_URL=https://.../ZyniVerse-1.4.3.apk
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

const FALLBACK_VERSION_NAME = "1.4.3";
const FALLBACK_VERSION_CODE = 140300;

/**
 * Verified metadata for builds we have actually published. Keeping it keyed by
 * version means bumping `MOBILE_VERSION_NAME` without also setting the env vars
 * can never make the app check a new APK against an old hash/size.
 */
const PUBLISHED_BUILDS: Record<string, { sha256: string; sizeBytes: number }> = {
  "1.4.3": {
    sha256: "4d092e816df37240a2fbbb50699196dd5848aeb25419bcddd507c017998a7fb8",
    sizeBytes: 42138561,
  },
  "1.4.2": {
    sha256: "b82b0aba6f9f88d4277258cfa2df83e1c4f7b8830cba869bc105972f86b55563",
    sizeBytes: 42131729,
  },
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
        "Removed every third-party website shortcut from the app; taps now stay on zyverse.in.",
        "New Aurora Launch theme replaces the Diwali skin with a cool cyan/violet look.",
        "New Episode Pulse screen: anonymous, aggregate episode reactions from the community.",
        "Fixed the stale Install button when 1.4.1 or 1.4.2 is already installed.",
        "APK hash, size and signer checks are unchanged: failed downloads are deleted, never installed.",
        "Signed with the same certificate as 1.4.1 and 1.4.2, so existing installs keep their data.",
      ]
  ).map((line) => line.trim()).filter(Boolean),
  mandatory: process.env.MOBILE_RELEASE_MANDATORY === "true",
  publishedAt: process.env.MOBILE_RELEASE_PUBLISHED_AT || "2026-11-20T03:43:00.000Z",
  minSupportedVersionCode: envNumber(process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE) || 130000,
};
