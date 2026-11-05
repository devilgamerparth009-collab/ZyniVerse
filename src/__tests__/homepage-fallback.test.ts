import { describe, it, expect } from "vitest";
import { withHomepageFallback } from "@/lib/homepage-fallback";
import type { HomepageData, Media } from "@/lib/anilist";

/**
 * The homepage is prerendered at build time and AniList rate-limits builds, so
 * `getHomepageData()` can legitimately return four empty rails. That used to be
 * baked into the HTML and shipped as the empty "✦ Spotlight" hero for a whole
 * revalidate window. These tests pin the guarantee that the snapshot fills any
 * hole — the real one-in-production case is `{ trending: [], ... }`.
 */

const fakeMedia = (id: number) => ({ id, title: { romaji: `Show ${id}` } }) as unknown as Media;

const emptyHomepage: HomepageData = {
  trending: [],
  popular: [],
  upcoming: [],
  topRated: [],
};

describe("withHomepageFallback", () => {
  it("fills every rail when the build fetch failed completely", () => {
    const result = withHomepageFallback(null);
    expect(result.trending.length).toBeGreaterThan(0);
    expect(result.popular.length).toBeGreaterThan(0);
    expect(result.upcoming.length).toBeGreaterThan(0);
    expect(result.topRated.length).toBeGreaterThan(0);
  });

  it("fills empty rails but keeps live rails untouched", () => {
    const liveTrending = [fakeMedia(1), fakeMedia(2)];
    const result = withHomepageFallback({
      ...emptyHomepage,
      trending: liveTrending,
    });

    expect(result.trending).toBe(liveTrending);
    expect(result.popular.length).toBeGreaterThan(0);
    expect(result.upcoming.length).toBeGreaterThan(0);
    expect(result.topRated.length).toBeGreaterThan(0);
  });

  it("leaves a fully live payload unchanged", () => {
    const live: HomepageData = {
      trending: [fakeMedia(10)],
      popular: [fakeMedia(20)],
      upcoming: [fakeMedia(30)],
      topRated: [fakeMedia(40)],
    };

    expect(withHomepageFallback(live)).toEqual(live);
  });

  it("ships real cover art so the hero is never blank", () => {
    const { trending } = withHomepageFallback(null);
    const hero = trending[0];
    const cover = hero.coverImage.extraLarge ?? hero.coverImage.large;

    expect(hero.title.romaji.length).toBeGreaterThan(0);
    expect(cover).toMatch(/^https:\/\//);
  });
});
