/**
 * Single source of truth for the Android release that the in-app updater
 * offers. Bump this block when you publish a new APK; the website is the only
 * thing that has to be redeployed — users do not need to reinstall manually.
 *
 * Everything is overridable through environment variables so a release can be
 * rolled out from Vercel without touching code:
 *
 *   MOBILE_VERSION_NAME=1.4.4
 *   MOBILE_VERSION_CODE=144000
 *   MOBILE_APK_URL=https://.../ZyniVerse-1.4.4.apk
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
  /** Explicit downgrade request; never inferred from a higher installed version. */
  rollback: boolean;
  publishedAt: string;
  /** Oldest build that can still open the app; below this the update is forced. */
  minSupportedVersionCode: number;
}

/** Version baked into the 1.6.0 source tree. */
const TARGET_VERSION_NAME = "1.6.0";
const TARGET_VERSION_CODE = 160000;

/** Last verified, publicly downloadable release. */
const STABLE_VERSION_NAME = "1.6.0";
const STABLE_VERSION_CODE = 160000;

/**
 * Verified metadata for builds we have actually published. Keeping it keyed by
 * version means bumping `MOBILE_VERSION_NAME` without also setting the env vars
 * can never make the app check a new APK against an old hash/size.
 */
const PUBLISHED_BUILDS: Record<string, { sha256: string; sizeBytes: number }> = {
  "1.5.5": {
    sha256: "9bdff38505513d8173cced22e3cc83c7bc5f32ce163aed57cf7ceb596b446026",
    sizeBytes: 42686001,
  },
  "1.5.4": {
    sha256: "6576ffe05b6bcef209bcef35e2f6a7c6c73a31cc8faccfa03646d1279c63572d",
    sizeBytes: 42156525,
  },
  "1.5.3": {
    sha256: "0bcd5c12988aee67ecccd2fb4f8771c612bc95c67ae976bcc71024ad8f39384a",
    sizeBytes: 42152365,
  },
  "1.4.5": {
    sha256: "0234459e8e8a132c13d1513b791707053de7158906ab978dd569d53e8a40aa96",
    sizeBytes: 42150001,
  },
  "1.4.4": {
    sha256: "f6f877354ef1a260b3cde5f180fcc4e96241d5ab5f2f6169c9b773dc2e71ad94",
    sizeBytes: 42150145,
  },
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
    sha256: "b6acc171c7dcaaad6aebb99cf95ad12f89e08669910f65353a374a1f0591dd95",
    sizeBytes: 42702933,
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
  return `https://github.com/devilgamerparth009-collab/ZyniVerse/releases/download/v${versionName}/ZyniVerse-${versionName}.apk`;
}

/**
 * 1.6.0 is the verified stable build in GitHub Releases. A future source bump
 * alone must never hand out a URL that 404s: without a matching hash/size entry
 * the default stays here until all three env overrides are supplied together.
 */
const targetHasVerifiedBuild = Boolean(PUBLISHED_BUILDS[TARGET_VERSION_NAME]);
const envTargetReady =
  Boolean(process.env.MOBILE_APK_URL) &&
  Boolean(process.env.MOBILE_APK_SHA256) &&
  Boolean(envNumber(process.env.MOBILE_APK_SIZE));
const targetReady = targetHasVerifiedBuild || envTargetReady;

const versionName = targetReady
  ? process.env.MOBILE_VERSION_NAME || TARGET_VERSION_NAME
  : STABLE_VERSION_NAME;
const versionCode = targetReady
  ? envNumber(process.env.MOBILE_VERSION_CODE) || TARGET_VERSION_CODE
  : STABLE_VERSION_CODE;
const published = PUBLISHED_BUILDS[versionName];

const TARGET_NOTES = [
  "Refreshed Dub Hub artwork and safer title matching so more anime open correctly.",
  "Added a full filler-guide library with search and title lookup.",
  "Added Feed, Tracker, Communities, Chat and Vibe screens for your anime life.",
  "Hot takes, tracked titles, clubs and chats stay saved on this device and work offline.",
  "Your existing saved data and preferences are preserved when you update.",
];

export const MOBILE_RELEASE: MobileRelease = {
  versionName,
  versionCode,
  apkUrl: process.env.MOBILE_APK_URL || websiteAsset(versionName),
  sha256: process.env.MOBILE_APK_SHA256 || published?.sha256,
  sizeBytes: envNumber(process.env.MOBILE_APK_SIZE) || published?.sizeBytes,
  notes: (process.env.MOBILE_RELEASE_NOTES
    ? process.env.MOBILE_RELEASE_NOTES.split("|")
    : TARGET_NOTES
  ).map((line) => line.trim()).filter(Boolean),
  mandatory: process.env.MOBILE_RELEASE_MANDATORY === "true",
  rollback: process.env.MOBILE_RELEASE_ROLLBACK === "true",
  publishedAt: process.env.MOBILE_RELEASE_PUBLISHED_AT || "2026-11-24T19:00:00.000Z",
  minSupportedVersionCode: envNumber(process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE) || 130000,
};
