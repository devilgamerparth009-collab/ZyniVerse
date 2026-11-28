// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DubCountdownChip,
  DubScheduleTickerProvider,
} from "@/components/hindi-dub/DubScheduleTicker";

const slot = {
  releaseAt: "2026-11-25T14:00:00.000Z",
  dayLabel: "Wednesday",
  timeLabel: "7:30 pm",
  episodeInfo: "EP 6",
};

function Tree() {
  return (
    <DubScheduleTickerProvider>
      <DubCountdownChip slot={slot} />
    </DubScheduleTickerProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DubScheduleTicker", () => {
  it("renders a stable placeholder on the server so hydration matches", () => {
    expect(renderToString(<Tree />)).toContain("--");
  });

  it("ticks from one shared clock after mount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));

    render(<Tree />);
    expect(screen.getByText("1d 4h 0m")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("1d 3h 59m")).toBeTruthy();
  });
});
