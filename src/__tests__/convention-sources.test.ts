import { describe, expect, it, vi } from "vitest";
import {
  buildApprovedPatches,
  buildConventionReview,
  canApplyProposal,
  collectNewsNotes,
  isAuthoritativeSourceForField,
  parsePublishedDateRange,
  resolveSourcesFor,
  selectPublicWatchRows,
  SOURCE_CATALOG,
  type ConventionReviewQueue,
  type ConventionWatchRow,
  type FetchPageResult,
  type ReviewProposal,
} from "@/lib/convention-sources";

const CHECKED_AT = "2026-11-28T00:00:00.000Z";

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
    organizers: ["Comic Con India", "NODWIN Gaming"],
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
    decision: "pending",
    checkedAt: CHECKED_AT,
    ...overrides,
  };
}

describe("parsePublishedDateRange", () => {
  it("parses ordinal day-first ranges without timezone shifts", () => {
    expect(parsePublishedDateRange("5th - 6th Dec 2026")).toEqual({
      startDate: "2026-12-05",
      endDate: "2026-12-06",
    });
  });

  it("parses month-first and multi-day ranges", () => {
    expect(parsePublishedDateRange("December 7-13, 2026")).toEqual({
      startDate: "2026-12-07",
      endDate: "2026-12-13",
    });
  });

  it("parses a single published day", () => {
    expect(parsePublishedDateRange("Nov 28, 2026")).toEqual({
      startDate: "2026-11-28",
      endDate: "2026-11-28",
    });
  });

  it("returns null instead of guessing from vague copy", () => {
    expect(parsePublishedDateRange("Dates to be announced")).toBeNull();
  });
});

describe("source ownership", () => {
  it("gives Comic Con dates/venue to the organiser and images/tickets to the ticket portal", () => {
    const sources = resolveSourcesFor(row(), CHECKED_AT);
    const official = sources.find((source) => source.id === "comic-con-official");
    const tickets = sources.find((source) => source.id === "comic-con-tickets");

    expect(official?.parseable).toBe(true);
    expect(tickets?.parseable).toBe(true);
    expect(isAuthoritativeSourceForField(official!, "startDate")).toBe(true);
    expect(isAuthoritativeSourceForField(official!, "venue")).toBe(true);
    expect(isAuthoritativeSourceForField(tickets!, "image")).toBe(true);
    expect(isAuthoritativeSourceForField(tickets!, "ticketUrl")).toBe(true);
    expect(sources.some((source) => source.kind === "news")).toBe(true);
    expect(sources.find((source) => source.excluded)?.id).toBe("rostercon-discovery");
  });

  it("uses Anime India for venue/guests and District only for availability", () => {
    const animeRow = row({
      id: "anime-india-kolkata-2027",
      name: "Anime India Kolkata 2027",
      city: "Kolkata",
      website: "https://animeindia.live/kolkata/",
      ticketUrl: "https://www.district.in/events/anime-india-kolkata-2027-buy-tickets",
      organizers: ["AnimationXpress"],
      startDate: "2027-02-27",
      endDate: "2027-02-28",
    });
    const sources = resolveSourcesFor(animeRow, CHECKED_AT);
    const official = sources.find((source) => source.id === "anime-india-official");
    const district = sources.find((source) => source.id === "district-tickets");

    expect(official?.parseable).toBe(true);
    expect(isAuthoritativeSourceForField(official!, "venue")).toBe(true);
    expect(isAuthoritativeSourceForField(district!, "venue")).toBe(false);
    expect(isAuthoritativeSourceForField(district!, "ticketUrl")).toBe(false);
  });

  it("does not parse a reused city page for an archived Anime India edition", () => {
    const archived = resolveSourcesFor(row({
      id: "anime-india-kolkata-2026",
      name: "Anime India Kolkata 2026",
      website: "https://animeindia.live/kolkata/",
      ticketUrl: null,
      organizers: ["AnimationXpress"],
      startDate: "2026-02-14",
      endDate: "2026-02-15",
    }), CHECKED_AT);
    expect(archived.find((source) => source.id === "anime-india-official")?.parseable).toBe(false);
  });
});

describe("review queue", () => {
  it("keeps official dates and ticket image as separate field proposals", async () => {
    const fetchPage = vi.fn(async (url: string): Promise<FetchPageResult> => {
      if (url.includes("comicconindia.com/all-cities-pages-2026/")) {
        return {
          ok: true,
          status: 200,
          html: `<h1 class="heading-123">6<sup>th</sup> - 7<sup>th</sup> Dec 2026<br/>NSIC Exhibition Grounds,<br/>Delhi</h1>
                 <section id="main-stage"><p class="cp-ms-row">Day 1</p></section>`,
        };
      }
      if (url.includes("tickets.comicconindia.com")) {
        const event = {
          "@context": "https://schema.org",
          "@type": "Event",
          name: "Delhi Comic Con 2026",
          image: "https://tickets.comicconindia.com/uploads/new.jpg",
          startDate: "2026-12-08",
          endDate: "2026-12-09",
          offers: { availability: "https://schema.org/InStock" },
        };
        return {
          ok: true,
          status: 200,
          html: `<link rel="canonical" href="https://tickets.comicconindia.com/delhi-comic-con-2026"/>
                 <script type="application/ld+json">${JSON.stringify(event)}</script>`,
        };
      }
      return { ok: true, status: 200, html: "<html></html>" };
    });

    const queue = await buildConventionReview({
      rows: [row()],
      fetchPage,
      checkedAt: CHECKED_AT,
    });

    const startDate = queue.proposals.find((item) => item.field === "startDate");
    const image = queue.proposals.find((item) => item.field === "image");

    expect(startDate?.sourceId).toBe("comic-con-official");
    expect(startDate?.proposedValue).toBe("2026-12-06");
    expect(image?.sourceId).toBe("comic-con-tickets");
    expect(image?.proposedValue).toBe("https://tickets.comicconindia.com/uploads/new.jpg");
    expect(queue.proposals.some((item) => item.field === "venue")).toBe(false);
    expect(queue.notes.some((note) => note.kind === "schedule")).toBe(true);
    expect(queue.errors).toHaveLength(0);
    expect(queue.mode).toBe("review-only");
  });

  it("turns news into notes on the matching event only", () => {
    const ann = SOURCE_CATALOG.find((source) => source.id === "ann-news")!;
    const ota = row({
      id: "ota-tokyo-delhi-2026",
      name: "Ōta TOKYO Delhi 2026",
      city: "Delhi",
      website: "https://otatokyo.jp/",
      ticketUrl: "https://otatokyo.jp/#tickets",
      organizers: ["Ōta TOKYO"],
    });
    const notes = collectNewsNotes(
      [row(), ota],
      [{ feed: ann, items: [{ title: "Ōta TOKYO announces a new guest", link: "https://example.test/news" }] }],
      CHECKED_AT
    );

    expect(notes).toHaveLength(1);
    expect(notes[0].eventId).toBe("ota-tokyo-delhi-2026");
    expect(notes[0].kind).toBe("news-signal");
  });

  it("never offers hidden, cancelled or archived rows to the watcher", () => {
    const rows = [
      row(),
      row({ id: "hidden-legacy", isPublic: false }),
      row({ id: "cancelled-event", status: "cancelled" }),
      row({ id: "past-event", startDate: "2026-01-01", endDate: "2026-01-02" }),
    ];
    expect(selectPublicWatchRows(rows, CHECKED_AT).map((item) => item.id)).toEqual([
      "comic-con-delhi-2026",
    ]);
  });
});

describe("approved patch safety", () => {
  it("allows only approved, authoritative, current-value-matched fields", () => {
    const valid = proposal({ decision: "approved" });
    const news = proposal({
      field: "name",
      currentValue: "Delhi Comic Con 2026",
      proposedValue: "Renamed by a news story",
      sourceId: "ann-news",
      sourceLabel: "Anime News Network",
      sourceKind: "news",
      sourceUrl: "https://www.animenewsnetwork.com/news/rss.xml",
      decision: "approved",
    });
    const aggregator = proposal({
      sourceId: "rostercon-discovery",
      sourceLabel: "Roster Con India (discovery only)",
      sourceKind: "aggregator",
      sourceUrl: "https://rostercon.com/en/location/india",
      decision: "approved",
    });
    const stale = proposal({
      field: "startDate",
      currentValue: "2025-01-01",
      proposedValue: "2026-12-07",
      sourceId: "comic-con-official",
      sourceLabel: "Comic Con India official city page",
      sourceKind: "official",
      sourceUrl: "https://www.comicconindia.com/all-cities-pages-2026/delhi-comic-con",
      decision: "approved",
    });
    const pending = proposal();

    expect(canApplyProposal(valid)).toBe(true);
    expect(canApplyProposal(news)).toBe(false);
    expect(canApplyProposal(aggregator)).toBe(false);
    expect(canApplyProposal(stale)).toBe(true);

    const queue: ConventionReviewQueue = {
      generatedAt: CHECKED_AT,
      mode: "review-only",
      policy: SOURCE_CATALOG,
      sourceMap: [],
      proposals: [valid, news, aggregator, stale, pending],
      notes: [],
      errors: [],
    };
    const patches = buildApprovedPatches(queue, [row()]);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      eventId: "comic-con-delhi-2026",
      field: "image",
      value: "https://tickets.comicconindia.com/uploads/new.jpg",
    });
  });
});
