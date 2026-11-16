import { NextRequest, NextResponse } from "next/server";
import { MOBILE_RELEASE } from "@/lib/mobile-release";

/**
 * In-app updater endpoint.
 *
 * GET /api/mobile/version?versionCode=160000&platform=android
 *
 * The Android client compares `latestVersionCode` with the build it is running
 * (expo-application `nativeBuildVersion`). When it is smaller, the app
 * downloads `apkUrl` and opens the system installer — no Play Store needed.
 */
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "*",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const currentCode =
    Number(searchParams.get("versionCode")) || Number(searchParams.get("version_code")) || 0;
  const platform = searchParams.get("platform") || "android";

  const release = MOBILE_RELEASE;
  const updateAvailable = currentCode > 0 && release.versionCode > currentCode;
  const belowMinimum = currentCode > 0 && currentCode < release.minSupportedVersionCode;

  return NextResponse.json(
    {
      platform,
      latestVersionName: release.versionName,
      latestVersionCode: release.versionCode,
      minSupportedVersionCode: release.minSupportedVersionCode,
      updateAvailable,
      mandatory: release.mandatory || belowMinimum,
      apkUrl: release.apkUrl,
      sha256: release.sha256 || null,
      sizeBytes: release.sizeBytes || null,
      notes: release.notes,
      publishedAt: release.publishedAt,
      // Handy for a future "install from website" page.
      downloadPage: "https://zyverse.in/download",
    },
    { headers: NO_STORE },
  );
}
