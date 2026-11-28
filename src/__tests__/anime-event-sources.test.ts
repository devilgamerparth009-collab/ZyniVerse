import { describe, expect, it } from "vitest";
import {
  collectEventNodes,
  infoboxField,
  parseEventDate,
  parseOfficialJsonLd,
  pickVenueForYear,
} from "@/lib/anime-event-sources";

/** AnimeJapan's Wikipedia venue cell lists several editions, like the live page. */
const MULTI_YEAR_VENUE =
  "Tokyo Big Sight (2014–2019, 2022–2026)<br/>Online (2021)<br/>[[Intex Osaka]] (2027–present)";

describe("anime event source parsing", () => {
  it("only accepts a venue explicitly tied to the tracked year", () => {
    expect(pickVenueForYear(MULTI_YEAR_VENUE, 2027)).toBe("Intex Osaka");
    expect(pickVenueForYear(MULTI_YEAR_VENUE, 2026)).toBe("Tokyo Big Sight");
    expect(pickVenueForYear("Tokyo Big Sight", 2027)).toBeNull();
  });

  it("keeps <br> separators when reading the Wikipedia infobox", () => {
    const content = `{{Infobox event\n| venue = ${MULTI_YEAR_VENUE}\n| country = [[Japan]]\n}}`;
    const raw = infoboxField(content, "venue");
    expect(raw).toContain("<br/>");
    expect(pickVenueForYear(raw, 2027)).toBe("Intex Osaka");
  });

  it("keeps the published calendar date instead of shifting timezones", () => {
    expect(parseEventDate("2026-07-02T08:09:00-07:00")).toBe("2026-07-02");
    expect(parseEventDate("not a date")).toBeNull();
  });

  it("reads schema.org events nested inside @graph and rejects other years", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": [
        {
          "@type": "Event",
          name: "Anime Expo 2026",
          startDate: "2026-07-02T08:09:00-07:00",
          endDate: "2026-07-05T18:00:00-07:00",
          location: { name: "Los Angeles Convention Center" },
        },
      ],
    })}</script>`;

    const nodes = collectEventNodes(JSON.parse(html.match(/>([\s\S]*?)<\/script>/)?.[1] ?? "{}"));
    expect(nodes).toHaveLength(1);

    const patch = parseOfficialJsonLd(html, {
      slug: "anime-expo-2026",
      family: "Anime Expo",
      year: 2026,
      officialUrl: "https://www.anime-expo.org",
      officialHost: "anime-expo.org",
      checkJsonLd: true,
      badge: "official",
    });
    expect(patch?.startDate).toBe("2026-07-02");
    expect(patch?.location).toBe("Los Angeles Convention Center");
  });
});
