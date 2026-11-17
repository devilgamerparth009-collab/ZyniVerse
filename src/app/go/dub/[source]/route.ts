import { NextResponse } from "next/server";
import { DUB_SOURCES, DubSourceId, resolveSourceBase } from "@/lib/dub-import/sources";

export const dynamic = "force-dynamic";

/**
 * Stable outbound link for a dub source: `/go/dub/animedubhindi` always lands
 * on whichever host currently answers, so bookmarks and the app keep working
 * when the source site changes its domain.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;
  const cfg = DUB_SOURCES[source as DubSourceId];

  if (!cfg) {
    return NextResponse.redirect("https://zyverse.in/hindi-dub", 302);
  }

  try {
    const baseUrl = await resolveSourceBase(cfg.id);
    return NextResponse.redirect(baseUrl, 302);
  } catch {
    return NextResponse.redirect(cfg.candidates[0], 302);
  }
}
