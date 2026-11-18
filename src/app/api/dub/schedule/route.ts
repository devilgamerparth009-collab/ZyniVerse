import { NextResponse } from "next/server";
import { getDubSchedule, groupScheduleByDay, WEEKDAY_ORDER } from "@/lib/dub-import/queries";
import { withoutProviderFields } from "@/lib/dub-import/public-fields";
import {
  DUB_SCHEDULE_CACHE_META,
  scheduleJson,
} from "@/lib/dub-import/schedule-cache";

export const dynamic = "force-dynamic";

async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  try {
    const rows = await getDubSchedule({
      day: searchParams.get("day"),
      language: searchParams.get("language"),
      limit: Number(searchParams.get("limit")) || 200,
    });
    const grouped = groupScheduleByDay(rows);

    return scheduleJson(
      withoutProviderFields({
        success: true,
        total: rows.length,
        days: WEEKDAY_ORDER,
        groups: grouped.groups,
        unscheduled: grouped.other,
        items: rows,
        cache: DUB_SCHEDULE_CACHE_META,
      })
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub schedule", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handler(request);
}
