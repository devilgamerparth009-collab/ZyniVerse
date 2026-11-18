import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubOverview } from "@/lib/dub-import/queries";
import { withoutProviderFields } from "@/lib/dub-import/public-fields";

export const dynamic = "force-dynamic";

async function handler(): Promise<Response> {
  try {
    return withPublicCache(
      NextResponse.json(withoutProviderFields({ success: true, ...(await getDubOverview()) }))
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub overview", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<Response> {
  return handler();
}
