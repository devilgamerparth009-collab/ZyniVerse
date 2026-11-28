import { describe, expect, it } from "vitest";
import {
  formatDubCountdown,
  nextDubScheduleAt,
  splitDubDuration,
} from "@/lib/dub-schedule-time";

describe("dub-schedule-time", () => {
  const now = Date.parse("2026-11-24T10:00:00Z"); // Tuesday, 15:30 IST

  it("prefers a genuinely future releaseAt over the weekly fallback", () => {
    const future = "2026-11-26T10:00:00.000Z";
    expect(
      nextDubScheduleAt(
        { releaseAt: future, dayLabel: "Monday", timeLabel: "7:30 pm" },
        now
      )
    ).toBe(Date.parse(future));
  });

  it("rebuilds the next IST weekday slot when releaseAt has gone stale", () => {
    expect(
      nextDubScheduleAt(
        {
          releaseAt: "2026-11-20T14:00:00.000Z",
          dayLabel: "Wednesday",
          timeLabel: "7:30 pm",
          episodeInfo: "EP 6",
        },
        now
      )
    ).toBe(Date.parse("2026-11-25T14:00:00.000Z"));
  });

  it("rolls a passed same-day slot to the following week", () => {
    const wednesdayEvening = Date.parse("2026-11-25T15:00:00Z"); // 20:30 IST
    expect(
      nextDubScheduleAt(
        { releaseAt: null, dayLabel: "Wednesday", timeLabel: "7:30 pm", episodeInfo: "EP 6" },
        wednesdayEvening
      )
    ).toBe(Date.parse("2026-12-02T14:00:00.000Z"));
  });

  it("supports daily and 12-hour labels for numbered episodes", () => {
    expect(
      nextDubScheduleAt(
        { releaseAt: null, dayLabel: "Daily", timeLabel: "9:30 PM", episodeInfo: "EP 5" },
        Date.parse("2026-11-24T16:00:00Z")
      )
    ).toBe(Date.parse("2026-11-25T16:00:00.000Z"));

    expect(
      nextDubScheduleAt(
        { releaseAt: null, dayLabel: "Tuesday", timeLabel: "11:30 am", episodeInfo: "EP 11" },
        Date.parse("2026-11-24T04:00:00Z") // Tuesday, 09:30 IST
      )
    ).toBe(Date.parse("2026-11-24T06:00:00.000Z"));

    expect(
      nextDubScheduleAt(
        { releaseAt: null, dayLabel: "Tuesday", timeLabel: "19:30", episodeInfo: "EP 11" },
        now
      )
    ).toBe(Date.parse("2026-11-24T14:00:00.000Z"));
  });

  it("never invents a timer for undated Coming Soon placeholders", () => {
    // Source has Daily 09:00 PM but explicitly "Date Not Announced".
    expect(
      nextDubScheduleAt(
        { releaseAt: null, dayLabel: "Daily", timeLabel: "09:00 PM", episodeInfo: null },
        now
      )
    ).toBeNull();
    expect(
      nextDubScheduleAt(
        {
          releaseAt: "2026-11-20T16:00:00.000Z",
          dayLabel: "Daily",
          timeLabel: "09:00 PM",
          episodeInfo: "Coming Soon",
        },
        now
      )
    ).toBeNull();

    // A dated Coming Soon row is still a real airing.
    expect(
      nextDubScheduleAt(
        {
          releaseAt: "2026-11-28T14:00:00.000Z",
          dayLabel: "Saturday 28 Nov 2026",
          timeLabel: "07:30 PM",
          episodeInfo: null,
        },
        now
      )
    ).toBe(Date.parse("2026-11-28T14:00:00.000Z"));
  });

  it("returns null when neither timestamp nor slot is usable", () => {
    expect(nextDubScheduleAt({ releaseAt: null, dayLabel: null, timeLabel: null }, now)).toBeNull();
    expect(
      nextDubScheduleAt({ releaseAt: "not-a-date", dayLabel: "Funday", timeLabel: "7:30 pm" }, now)
    ).toBeNull();
  });

  it("formats deterministic countdowns", () => {
    const target = now + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000;
    expect(splitDubDuration(target, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      done: false,
    });
    expect(formatDubCountdown(target, now)).toBe("2d 3h 4m");
    expect(formatDubCountdown(now, now)).toBe("Airing now");
  });
});
