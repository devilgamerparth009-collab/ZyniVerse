import { NextResponse } from "next/server";
import { MOBILE_RELEASE } from "@/lib/mobile-release";

/**
 * Stable download URL for the current APK: https://zyverse.in/api/mobile/download
 *
 * The in-app updater reads /api/mobile/version and downloads the asset
 * directly, but this redirect is handy for QR codes, social posts and the
 * /download page — the target can change without touching the public URL.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.redirect(MOBILE_RELEASE.apkUrl, 302);
}
