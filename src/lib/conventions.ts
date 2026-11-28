import { prisma } from "@/lib/prisma";
import { getIndiaDateKey, toDateKey } from "@/lib/convention-dates";

export interface Convention {
  id: string;
  name: string;
  shortName: string | null;
  city: string;
  state: string;
  venue: string;
  startDate: string;
  endDate: string;
  website: string;
  ticketUrl: string | null;
  image: string | null;
  description: string;
  estimatedAttendance: number | null;
  status: "upcoming" | "ongoing" | "past" | "cancelled";
  organizers: string[];
  tags: string[];
}

export async function getConventions(filters?: {
  city?: string;
  state?: string;
  status?: "upcoming" | "past" | "ongoing" | "all";
  month?: number;
  year?: number;
}): Promise<Convention[]> {
  const where: Record<string, unknown> = { isPublic: true };

  if (filters?.city) {
    where.city = { contains: filters.city, mode: "insensitive" };
  }
  if (filters?.state) {
    where.state = { contains: filters.state, mode: "insensitive" };
  }
  if (filters?.month !== undefined || filters?.year !== undefined) {
    const AND: Record<string, unknown>[] = [];
    const referenceYear = filters?.year ?? new Date().getFullYear();
    if (filters?.month !== undefined && filters.month >= 1 && filters.month <= 12) {
      const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
      const nextYear = filters.month === 12 ? referenceYear + 1 : referenceYear;
      AND.push({
        startDate: {
          gte: new Date(Date.UTC(referenceYear, filters.month - 1, 1)),
          lt: new Date(Date.UTC(nextYear, nextMonth - 1, 1)),
        },
      });
    }
    if (filters?.year !== undefined) {
      AND.push({
        startDate: {
          gte: new Date(Date.UTC(filters.year, 0, 1)),
          lt: new Date(Date.UTC(filters.year + 1, 0, 1)),
        },
      });
    }
    if (AND.length > 0) where.AND = AND;
  }

  const results = await prisma.convention.findMany({
    where,
    orderBy: { startDate: "asc" },
  });

  const mapped = results.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    city: r.city,
    state: r.state,
    venue: r.venue,
    startDate: toDateKey(r.startDate),
    endDate: toDateKey(r.endDate),
    website: r.website,
    ticketUrl: r.ticketUrl,
    image: r.image,
    description: r.description,
    estimatedAttendance: r.estimatedAttendance,
    status: computeConventionStatus(r),
    organizers: r.organizers,
    tags: r.tags,
  }));

  if (filters?.status && filters.status !== "all") {
    return mapped.filter((c) => c.status === filters.status);
  }

  return mapped;
}

/** Compare date keys so an event stays "ongoing" for its full final day. */
export function computeConventionStatus(
  r: { startDate: Date; endDate: Date; status: string },
  now: Date = new Date()
): Convention["status"] {
  if (r.status === "cancelled") return "cancelled";
  const today = getIndiaDateKey(now);
  if (today < toDateKey(r.startDate)) return "upcoming";
  if (today <= toDateKey(r.endDate)) return "ongoing";
  return "past";
}


export async function getConventionById(id: string): Promise<Convention | null> {
  const result = await prisma.convention.findFirst({ where: { id, isPublic: true } });
  if (!result) return null;
  return {
    id: result.id,
    name: result.name,
    shortName: result.shortName,
    city: result.city,
    state: result.state,
    venue: result.venue,
    startDate: toDateKey(result.startDate),
    endDate: toDateKey(result.endDate),
    website: result.website,
    ticketUrl: result.ticketUrl,
    image: result.image,
    description: result.description,
    estimatedAttendance: result.estimatedAttendance,
    status: computeConventionStatus(result),
    organizers: result.organizers,
    tags: result.tags,
  };
}

export async function getCities(): Promise<string[]> {
  const results = await prisma.convention.findMany({
    where: { isPublic: true },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });
  return results.map((r) => r.city);
}

export async function getStates(): Promise<string[]> {
  const results = await prisma.convention.findMany({
    where: { isPublic: true },
    select: { state: true },
    distinct: ["state"],
    orderBy: { state: "asc" },
  });
  return results.map((r) => r.state);
}
