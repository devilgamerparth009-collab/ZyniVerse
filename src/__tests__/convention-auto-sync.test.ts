import { describe, expect, it } from "vitest";
import { buildAutoUpdatePlans } from "@/lib/convention-auto-sync";
import type { ApprovedPatch, ConventionWatchRow, ReviewProposal } from "@/lib/convention-sources";

const TODAY = "2026-11-28";

function row(overrides: Partial<ConventionWatchRow> = {}): ConventionWatchRow {
  return {
    id: "comic-con-delhi-2026",
    name: "Delhi Comic Con 2026",
    city: "Delhi",
    state: "Delhi",
    venue: "NSIC Exhibition Grounds, Okhla",
    website: "https://www.comicconindia.com/all-cities-pages-2026/delhi-comic-con",
    ticketUrl: "https://tickets.comicconindia.com/delhi-comic-con-2026",
    image: "https://tickets.comicconindia.com/uploads/old.jpg",
    startDate: "2026-12-05",
    endDate: "2026-12-06",
    organizers: ["Comic Con India"],
    tags: ["comic-con"],
    isPublic: true,
    status: "upcoming",
    ...overrides,
  };
}

function proposal(overrides: Partial<ReviewProposal> = {}): ReviewProposal {
  return {
    eventId: "comic-con-delhi-2026",
    field: "image",
    currentValue: "https://tickets.comicconindia.com/uploads/old.jpg",
    proposedValue: "https://tickets.comicconindia.com/uploads/new.jpg",
    sourceId: "comic-con-tickets",
    sourceLabel: "Comic Con India official ticket portal",
    sourceKind: "ticket",
    sourceUrl: "https://tickets.comicconindia.com/delhi-comic-con-2026",
    confidence: "high",
    status: "needs-review",
    decision: "approved",
    checkedAt: "2026-11-28T00:00:00.000Z",
    ...overrides,
  };
}

function patch(overrides: Partial<ApprovedPatch> = {}): ApprovedPatch {
  const base = proposal();
  return {
    eventId: base.eventId,
    field: base.field,
    value: base.proposedValue,
    proposal: base,
    ...overrides,
  };
}

describe("buildAutoUpdatePlans", () => {
  it("combines field changes for one event into a single valid write", () => {
    const { plans, skipped } = buildAutoUpdatePlans(
      [
        patch({ field: "startDate", value: "2026-12-12", proposal: proposal({ field: "startDate" }) }),
        patch({ field: "endDate", value: "2026-12-13", proposal: proposal({ field: "endDate" }) }),
        patch(),
      ],
      [row()],
      TODAY
    );

    expect(skipped).toHaveLength(0);
    expect(plans).toHaveLength(1);
    expect(plans[0].data.startDate).toEqual(new Date("2026-12-12T00:00:00Z"));
    expect(plans[0].data.endDate).toEqual(new Date("2026-12-13T00:00:00Z"));
    expect(plans[0].data.image).toBe("https://tickets.comicconindia.com/uploads/new.jpg");
  });

  it("rejects past dates, hidden rows and an invalid combined range", () => {
    const past = buildAutoUpdatePlans(
      [patch({ field: "startDate", value: "2026-01-01", proposal: proposal({ field: "startDate" }) })],
      [row()],
      TODAY
    );
    expect(past.plans).toHaveLength(0);
    expect(past.skipped[0].reason).toBe("proposed date is in the past");

    const hidden = buildAutoUpdatePlans([patch()], [row({ isPublic: false })], TODAY);
    expect(hidden.plans).toHaveLength(0);
    expect(hidden.skipped[0].reason).toBe("row is not public");

    const invalidRange = buildAutoUpdatePlans(
      [
        patch({ field: "startDate", value: "2026-12-20", proposal: proposal({ field: "startDate" }) }),
        patch({ field: "endDate", value: "2026-12-13", proposal: proposal({ field: "endDate" }) }),
      ],
      [row()],
      TODAY
    );
    expect(invalidRange.plans).toHaveLength(0);
    expect(invalidRange.skipped).toHaveLength(2);
    expect(invalidRange.skipped[0].reason).toBe("combined date range would be invalid");
  });
});
