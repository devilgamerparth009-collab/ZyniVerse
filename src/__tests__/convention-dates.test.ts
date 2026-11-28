import { describe, expect, it } from "vitest";
import {
  addDaysToDateOnly,
  daysUntilDate,
  formatDetailDateRange,
  formatShortDateRange,
  getDateParts,
  getIndiaDateKey,
  toDateKey,
} from "@/lib/convention-dates";

describe("convention date helpers", () => {
  it("reads date-only strings without timezone shifting", () => {
    expect(getDateParts("2026-11-28")).toEqual({ year: 2026, month: 11, day: 28 });
    expect(toDateKey(new Date("2027-02-06"))).toBe("2027-02-06");
  });

  it("formats short ranges across months and years", () => {
    expect(formatShortDateRange("2026-11-28", "2026-11-29")).toBe("28 Nov — 29 Nov, 2026");
    expect(formatShortDateRange("2026-12-19", "2027-01-03")).toBe("19 Dec — 3 Jan, 2027");
    expect(formatShortDateRange("2026-07-10", "2026-07-10")).toBe("10 Jul, 2026");
  });

  it("formats detail ranges without an off-by-one weekday", () => {
    expect(formatDetailDateRange("2026-11-28", "2026-11-29")).toBe(
      "Saturday, 28 November — Sunday, 29 November 2026"
    );
    expect(formatDetailDateRange("2026-12-05", "2026-12-05")).toBe(
      "Saturday, 5 December 2026"
    );
  });

  it("uses India calendar days for countdowns", () => {
    expect(getIndiaDateKey(new Date("2026-11-28T18:30:00Z"))).toBe("2026-11-29");
    expect(daysUntilDate("2026-11-29", new Date("2026-11-28T04:00:00Z"))).toBe(1);
    expect(daysUntilDate("2026-12-05", new Date("2026-11-28T04:00:00Z"))).toBe(7);
  });

  it("adds days without daylight-saving drift", () => {
    expect(addDaysToDateOnly("2026-12-31", 1)).toBe("2027-01-01");
  });
});
