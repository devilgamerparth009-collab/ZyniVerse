/**
 * Mobile-facing schedule responses must not pretend the airing table is static.
 *
 * The generic public API cache stores responses for 5 minutes plus a 10 minute
 * stale-while-revalidate window (up to 15 minutes of possible staleness). For
 * schedules we keep a 5 minute CDN TTL with a small 1 minute SWR grace, and
 * report the same numbers in the body so clients can align their own polling.
 */
import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/api-cache";

export const DUB_SCHEDULE_MAX_AGE = 300;
export const DUB_SCHEDULE_STALE_WHILE_REVALIDATE = 60;

export const DUB_SCHEDULE_CACHE_META = {
  maxAge: DUB_SCHEDULE_MAX_AGE,
  staleWhileRevalidate: DUB_SCHEDULE_STALE_WHILE_REVALIDATE,
} as const;

export function scheduleJson(body: unknown): Response {
  const response = withPublicCache(NextResponse.json(body));
  // `withPublicCache` sets the generic TTL; override it for schedule payloads.
  response.headers.set(
    "Cache-Control",
    `public, s-maxage=${DUB_SCHEDULE_MAX_AGE}, stale-while-revalidate=${DUB_SCHEDULE_STALE_WHILE_REVALIDATE}`
  );
  return response;
}
