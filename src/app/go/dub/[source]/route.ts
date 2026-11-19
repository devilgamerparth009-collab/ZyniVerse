import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DUB_SOURCES, DubSourceId } from "@/lib/dub-import/sources";

export const dynamic = "force-dynamic";

/**
 * Stable outbound link for a dub catalog.
 *
 * This must stay fast: it is opened directly from the app, so network probing
 * (which can take longer than the platform's response budget) is deliberately
 * avoided here. The last known working host is read from the database when
 * available, otherwise the first configured address is used. Schedule sync
 * keeps that stored host up to date separately.
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

  let target = cfg.candidates[0];
  try {
    const state = await prisma.dubSourceState.findUnique({ where: { source: cfg.id } });
    if (state?.baseUrl && cfg.candidates.includes(state.baseUrl)) target = state.baseUrl;
  } catch {
    // Fall back to the configured address if the state table is unavailable.
  }

  return NextResponse.redirect(target, 302);
}
