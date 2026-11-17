import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { getDubSchedule, groupScheduleByDay, WEEKDAY_ORDER } from "@/lib/dub-import/queries";

export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const rows = await getDubSchedule({
      day: searchParams.get("day"),
      language: searchParams.get("language"),
      limit: Number(searchParams.get("limit")) || 200,
    });
    const grouped = groupScheduleByDay(rows);

    return NextResponse.json({
      success: true,
      total: rows.length,
      days: WEEKDAY_ORDER,
      groups: grouped.groups,
      unscheduled: grouped.other,
      items: rows,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load dub schedule", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return withPublicCache(await handler(request));
}
