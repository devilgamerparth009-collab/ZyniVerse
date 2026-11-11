import { NextRequest, NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";
import { TV_CHANNELS, getDayName } from "@/lib/tv-channels";
import { buildTvSchedule, getScheduleDays } from "@/lib/tv-schedule-data";

// The first request of the day may scrape epg.pw (a few seconds); later
// requests are answered from the DB cache. 30s keeps us safely under the cap.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

async function GET_inner(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const channel = searchParams.get("channel");
    const day = searchParams.get("day") || getDayName();
    const search = searchParams.get("search")?.toLowerCase().trim();
    const type = searchParams.get("type") as "tv" | "youtube" | null;

    const grid = await buildTvSchedule(day);

    if (channel) {
      const ch = TV_CHANNELS[channel];
      if (!ch) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
      const entry = grid.channels.find((c) => c.channelId === channel);
      const slots = entry?.days[grid.day] || [];
      return NextResponse.json({
        channel: ch,
        day: grid.day,
        schedule: { day: grid.day, slots },
        updatedAt: grid.updatedAt,
      });
    }

    let entries = grid.channels;
    if (type) entries = entries.filter((c) => c.channelType === type);

    const channels = entries.map((entry) => {
      const ch = TV_CHANNELS[entry.channelId];
      let slots = entry.days[grid.day] || [];
      if (search) {
        slots = slots.filter((slot) => slot.show.toLowerCase().includes(search));
      }
      return {
        channel: ch,
        schedule: { day: grid.day, slots },
      };
    });

    return NextResponse.json({
      day: grid.day,
      today: grid.today,
      updatedAt: grid.updatedAt,
      liveAiringTotal: grid.liveAiringTotal,
      channels,
      availableDays: getScheduleDays(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(...args: Parameters<typeof GET_inner>) {
  const res = await GET_inner(...args);
  return withPublicCache(res);
}
