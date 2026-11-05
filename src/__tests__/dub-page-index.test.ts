import { describe, it, expect } from "vitest";
import {
  DUB_PAGES,
  DUB_PAGE_SLUGS,
  dubSlugify,
  getDubPage,
  getDubPageSlugForMalId,
  getDubPageSlugForTitle,
  getRelatedDubPages,
} from "@/lib/dub-page-index";
import { INDIAN_DUB_GUIDES } from "@/lib/indian-dub-guides";

/**
 * The /indian-dubs route used to serve only the 41 hand-written guides while
 * ~105 verified dub entries sat unused on /dubbed as cards. Expanding the
 * route is only safe if the merge stays deterministic: unique slugs, no
 * duplicate titles (a thinner duplicate would compete with the richer guide),
 * and lookups that actually resolve.
 */

describe("dub-page-index", () => {
  it("keeps every hand-written guide at its existing URL", () => {
    for (const guide of INDIAN_DUB_GUIDES) {
      const page = getDubPage(guide.slug);
      expect(page?.kind).toBe("guide");
      if (page?.kind === "guide") expect(page.guide).toBe(guide);
    }
  });

  it("expands the route beyond the 41 guides using verified dub entries", () => {
    expect(DUB_PAGES.length).toBeGreaterThan(INDIAN_DUB_GUIDES.length);
    expect(DUB_PAGES.length).toBeGreaterThanOrEqual(80);
    expect(DUB_PAGE_SLUGS.length).toBe(DUB_PAGES.length);
  });

  it("produces unique, URL-safe slugs", () => {
    expect(new Set(DUB_PAGE_SLUGS).size).toBe(DUB_PAGE_SLUGS.length);
    for (const slug of DUB_PAGE_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("never ships two pages for the same MAL id", () => {
    const malIds: number[] = [];
    for (const page of DUB_PAGES) {
      const malId = page.kind === "guide" ? page.guide.malId : page.entry.mal_id;
      if (typeof malId === "number") malIds.push(malId);
    }
    // Guides without a MAL id cannot collide, so compare only rows that have one.
    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const id of malIds) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    expect(duplicates).toEqual([]);
  });

  it("resolves a MAL id and a title back to the same page", () => {
    const entry = DUB_PAGES.find((p) => p.kind === "entry");
    expect(entry).toBeDefined();
    if (entry?.kind !== "entry") return;

    expect(getDubPageSlugForMalId(entry.entry.mal_id)).toBe(entry.slug);
    expect(getDubPageSlugForTitle(entry.name)).toBe(entry.slug);
    expect(getDubPageSlugForTitle(entry.name.toUpperCase())).toBe(entry.slug);
  });

  it("returns related pages without repeating the current one", () => {
    const page = DUB_PAGES.find((p) => p.kind === "guide");
    expect(page).toBeDefined();
    if (!page) return;

    const related = getRelatedDubPages(page, 4);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related.some((p) => p.slug === page.slug)).toBe(false);
  });

  it("slugifies punctuation and accents deterministically", () => {
    expect(dubSlugify("Kimi no Na wa")).toBe("kimi-no-na-wa");
    expect(dubSlugify("Fate/Zero & Stay Night")).toBe("fate-zero-and-stay-night");
    expect(dubSlugify("  Yuri!!! on Ice  ")).toBe("yuri-on-ice");
    expect(dubSlugify("Café") ).toBe("cafe");
  });
});
