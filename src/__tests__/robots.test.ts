import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

/**
 * robots.txt is part of the Vercel quota strategy, not just SEO:
 *
 * - `/character/` and `/manga/` are infinite AniList mirrors that are not in
 *   the sitemap. They produced 73% of measured crawler hits (96k of 131k) with
 *   no measurable search referrals, and every first fetch is a Node render.
 * - `/anime/` and the sitemap-backed guides must stay crawlable because they
 *   are the pages we want indexed (and ad impressions come from real visitors
 *   landing there, not from crawlers).
 *
 * If someone removes the disallow, this test explains why it was there.
 */
describe("robots", () => {
  const config = robots();
  const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
  const wildcard = rules.find((r) => r.userAgent === "*");
  const disallow = (Array.isArray(wildcard?.disallow) ? wildcard.disallow : [wildcard?.disallow]) as string[];

  it("disallows the infinite character/manga catalog", () => {
    expect(disallow).toContain("/character/");
    expect(disallow).toContain("/manga/");
  });

  it("keeps the pages we actually want indexed crawlable", () => {
    // Only the mirror detail routes are disallowed; the hubs and the
    // sitemap-backed guides must remain reachable.
    expect(disallow).not.toContain("/anime/");
    expect(disallow).not.toContain("/watch/");
    expect(disallow).not.toContain("/indian-dubs/");
    expect(disallow).not.toContain("/manga");
    expect(disallow).not.toContain("/characters");
  });

  it("lets AdSense's content crawler reach the ad-bearing mirror pages", () => {
    const adsense = rules.find((r) => r.userAgent === "Mediapartners-Google");
    const adsenseDisallow = (
      Array.isArray(adsense?.disallow) ? adsense.disallow : [adsense?.disallow]
    ) as string[];
    expect(adsenseDisallow).not.toContain("/character/");
    expect(adsenseDisallow).not.toContain("/manga/");
    expect(adsenseDisallow).toContain("/api/");
  });

  it("still blocks private surfaces for the wildcard group", () => {
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/admin/");
    expect(disallow).toContain("/forum/");
  });

  it("publishes the single sitemap", () => {
    expect(config.sitemap).toEqual(["https://zyverse.in/sitemap.xml"]);
  });
});
