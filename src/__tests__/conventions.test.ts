import { describe, it, expect, vi } from "vitest";
import {
  computeConventionStatus,
  getConventions,
  getConventionById,
  getCities,
  getStates,
} from "@/lib/conventions";

interface ConventionRow {
  id: string;
  name: string;
  shortName: string | null;
  city: string;
  state: string;
  venue: string;
  website: string;
  ticketUrl: string | null;
  image: string | null;
  description: string;
  estimatedAttendance: number | null;
  status: string;
  organizers: string[];
  tags: string[];
  startDate: Date;
  endDate: Date;
  isPublic: boolean;
  [key: string]: unknown;
}

interface WhereInput {
  isPublic?: boolean;
  city?: { contains?: string; mode?: string };
  state?: { contains?: string; mode?: string };
  status?: string;
  AND?: Array<Record<string, { gte?: Date; lt?: Date }>>;
}

const conventionMock = vi.hoisted(() => {
  const mk = (id: string, name: string, city: string, state: string, start: string, end: string): ConventionRow => ({
    id,
    name,
    shortName: null,
    city,
    state,
    venue: "Test Venue",
    website: "https://example.com",
    ticketUrl: null,
    image: null,
    description: "desc",
    estimatedAttendance: null,
    status: "upcoming",
    organizers: [],
    tags: ["anime"],
    startDate: new Date(start),
    endDate: new Date(end),
    isPublic: true,
  });

  const data: ConventionRow[] = [
    mk("comic-con-delhi-jul", "Comic Con Delhi July 2026", "Delhi", "Delhi", "2026-07-10", "2026-07-12"),
    mk("anime-expo-delhi", "Anime Expo India Delhi", "Delhi", "Delhi", "2026-08-15", "2026-08-17"),
    mk("comic-con-mumbai", "Comic Con Mumbai", "Mumbai", "Maharashtra", "2026-08-28", "2026-08-30"),
    mk("bengaluru-anime-con", "Bengaluru Anime Con", "Bengaluru", "Karnataka", "2026-07-18", "2026-07-19"),
    mk("comic-con-pune", "Comic Con Pune", "Pune", "Maharashtra", "2026-11-20", "2026-11-22"),
    mk("comic-con-december", "Comic Con December", "Delhi", "Delhi", "2026-12-05", "2026-12-06"),
    { ...mk("legacy-hidden", "Legacy Hidden Con", "Pune", "Maharashtra", "2027-01-01", "2027-01-02"), isPublic: false },
    // Keep one event in the future regardless of when the suite is run.
    mk(
      "future-anime-con",
      "Future Anime Con",
      "Chennai",
      "Tamil Nadu",
      new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      new Date(Date.now() + 62 * 86400000).toISOString().slice(0, 10)
    ),
  ];

  const matchWhere = (row: ConventionRow, where?: WhereInput): boolean => {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (key === "AND") {
        const andGroups = val as WhereInput["AND"];
        for (const group of andGroups ?? []) {
          for (const [k2, cond] of Object.entries(group)) {
            const value = row[k2];
            if (cond.gte !== undefined && (value as Date) < cond.gte) return false;
            if (cond.lt !== undefined && (value as Date) >= cond.lt) return false;
          }
        }
      } else if (val && typeof val === "object" && "contains" in val) {
        const contains = (val as { contains: string }).contains;
        const field = String(row[key] ?? "");
        if ((val as { mode?: string }).mode === "insensitive") {
          if (!field.toLowerCase().includes(contains.toLowerCase())) return false;
        } else if (!field.includes(contains)) {
          return false;
        }
      } else if (row[key] !== val) {
        return false;
      }
    }
    return true;
  };

  const findMany = vi.fn(
    async (args: { where?: WhereInput; orderBy?: Record<string, string>; distinct?: string[]; select?: Record<string, boolean> } = {}) => {
      const { where, orderBy, distinct, select } = args;
      let rows: ConventionRow[] = data.filter((r) => matchWhere(r, where));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        rows = [...rows].sort((a, b) => {
          const av = String(a[field]);
          const bv = String(b[field]);
          const cmp = av > bv ? 1 : av < bv ? -1 : 0;
          return dir === "desc" ? -cmp : cmp;
        });
      }
      if (distinct) {
        rows = rows.filter((r, i, arr) => arr.findIndex((x) => x[distinct[0]] === r[distinct[0]]) === i);
      }
      if (select) {
        return rows.map((r) => Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])));
      }
      return rows;
    }
  );
  const findFirst = vi.fn(async ({ where }: { where: { id: string; isPublic?: boolean } }) =>
    data.find((r) => r.id === where.id && (where.isPublic === undefined || r.isPublic === where.isPublic)) ?? null
  );
  const count = vi.fn(async () => data.length);
  return { findMany, findFirst, count };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    convention: {
      findMany: conventionMock.findMany,
      findFirst: conventionMock.findFirst,
      count: conventionMock.count,
    },
    $disconnect: vi.fn(),
  },
}));

describe("getConventions", () => {
  it("returns all conventions when no filters", async () => {
    const all = await getConventions();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("city");
      expect(c).toHaveProperty("state");
      expect(c).toHaveProperty("startDate");
      expect(c).toHaveProperty("endDate");
      expect(c).toHaveProperty("status");
      expect(c).toHaveProperty("tags");
    }
  });

  it("filters by city", async () => {
    const delhi = await getConventions({ city: "Delhi" });
    expect(delhi.length).toBeGreaterThan(0);
    for (const c of delhi) {
      expect(c.city.toLowerCase()).toContain("delhi");
    }
  });

  it("filters by state", async () => {
    const mh = await getConventions({ state: "Maharashtra" });
    expect(mh.length).toBeGreaterThan(0);
    for (const c of mh) {
      expect(c.state).toBe("Maharashtra");
    }
  });

  it("filters by status", async () => {
    const upcoming = await getConventions({ status: "upcoming" });
    expect(upcoming.length).toBeGreaterThan(0);
    for (const c of upcoming) {
      expect(c.status).toBe("upcoming");
    }
  });

  it("filters by month", async () => {
    const july = await getConventions({ month: 7 });
    expect(july.length).toBeGreaterThan(0);
    for (const c of july) {
      const m = new Date(c.startDate).getMonth() + 1;
      expect(m).toBe(7);
    }
  });

  it("filters by year", async () => {
    const thisYear = await getConventions({ year: 2026 });
    expect(thisYear.length).toBeGreaterThan(0);
    for (const c of thisYear) {
      expect(new Date(c.startDate).getFullYear()).toBe(2026);
    }
  });

  it("filters December without wrapping to January of the same year", async () => {
    const december = await getConventions({ month: 12, year: 2026 });
    expect(december.length).toBeGreaterThan(0);
    for (const c of december) {
      expect(Number(c.startDate.slice(5, 7))).toBe(12);
      expect(c.startDate.slice(0, 4)).toBe("2026");
    }
  });

  it("combines month and year filters", async () => {
    const result = await getConventions({ month: 12, year: 2026 });
    expect(result.every((c) => c.startDate.startsWith("2026-12"))).toBe(true);
  });

  it("returns empty array for non-matching filters", async () => {
    const result = await getConventions({ city: "NonExistentCity" });
    expect(result).toEqual([]);
  });
});

describe("getConventionById", () => {
  it("returns convention by id", async () => {
    const c = await getConventionById("comic-con-delhi-jul");
    expect(c).toBeDefined();
    expect(c!.name).toContain("Comic Con Delhi");
  });

  it("returns null for non-existent id", async () => {
    const c = await getConventionById("non-existent");
    expect(c).toBeNull();
  });

  it("does not expose a legacy row hidden with isPublic=false", async () => {
    const c = await getConventionById("legacy-hidden");
    expect(c).toBeNull();
  });
});

describe("computeConventionStatus", () => {
  const row = {
    startDate: new Date("2026-11-28"),
    endDate: new Date("2026-11-29"),
    status: "upcoming",
  };

  it("marks an event as ongoing on its last calendar day in India", () => {
    expect(computeConventionStatus(row, new Date("2026-11-29T12:00:00Z"))).toBe("ongoing");
  });

  it("marks an event as past only after the last India day", () => {
    expect(computeConventionStatus(row, new Date("2026-11-29T19:00:00Z"))).toBe("past");
  });
});

describe("getCities", () => {
  it("returns sorted unique cities", async () => {
    const cities = await getCities();
    expect(Array.isArray(cities)).toBe(true);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities).toEqual([...cities].sort());
    expect(cities).toContain("Delhi");
    expect(cities).toContain("Mumbai");
  });
});

describe("getStates", () => {
  it("returns sorted unique states", async () => {
    const states = await getStates();
    expect(Array.isArray(states)).toBe(true);
    expect(states.length).toBeGreaterThan(0);
    expect(states).toEqual([...states].sort());
    expect(states).toContain("Maharashtra");
    expect(states).toContain("Delhi");
  });
});
