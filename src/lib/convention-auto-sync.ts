// Daily automatic convention fact sync.
//
// The watcher in `scripts/conventions-watch.ts` stays as the manual audit tool.
// This module is the unattended version used by the cron endpoint: it only
// applies field changes that came from an authoritative organiser/ticket source
// and survived the same validation rules as a human-approved review.

import { Prisma } from "@prisma/client";
import { getIndiaDateKey, toDateKey } from "@/lib/convention-dates";
import { prisma } from "@/lib/prisma";
import {
  buildApprovedPatches,
  buildConventionReview,
  defaultFetchPage,
  selectPublicWatchRows,
  type ApprovedPatch,
  type ConventionReviewQueue,
  type ConventionWatchRow,
} from "@/lib/convention-sources";

export interface AutoUpdatePlan {
  eventId: string;
  data: Record<string, string | Date>;
}

export interface AutoSyncSkip {
  eventId: string;
  field: string;
  reason: string;
}

export interface ConventionAutoSyncResult {
  success: boolean;
  checkedAt: string;
  reviewed: number;
  proposals: number;
  applied: Array<{ eventId: string; fields: string[]; sourceIds: string[] }>;
  skipped: AutoSyncSkip[];
  notes: number;
  errors: ConventionReviewQueue["errors"];
}

/** Guard the combined date range before writing it, not each field on its own. */
export function buildAutoUpdatePlans(
  patches: ApprovedPatch[],
  rows: ConventionWatchRow[],
  today: string
): { plans: AutoUpdatePlan[]; skipped: AutoSyncSkip[] } {
  const plans = new Map<string, AutoUpdatePlan>();
  const skipped: AutoSyncSkip[] = [];

  for (const patch of patches) {
    const row = rows.find((item) => item.id === patch.eventId && item.isPublic === true);
    if (!row) {
      skipped.push({ eventId: patch.eventId, field: patch.field, reason: "row is not public" });
      continue;
    }

    if (patch.field === "startDate" || patch.field === "endDate") {
      if (patch.value < today) {
        skipped.push({ eventId: patch.eventId, field: patch.field, reason: "proposed date is in the past" });
        continue;
      }
    }

    const plan = plans.get(patch.eventId) ?? { eventId: patch.eventId, data: {} };
    plan.data[patch.field] =
      patch.field === "startDate" || patch.field === "endDate"
        ? new Date(`${patch.value}T00:00:00Z`)
        : patch.value;
    plans.set(patch.eventId, plan);
  }

  const validPlans: AutoUpdatePlan[] = [];
  for (const plan of plans.values()) {
    const row = rows.find((item) => item.id === plan.eventId)!;
    const start = toDateKey((plan.data.startDate as Date | undefined) ?? row.startDate);
    const end = toDateKey((plan.data.endDate as Date | undefined) ?? row.endDate);
    if (start > end) {
      for (const field of Object.keys(plan.data)) {
        skipped.push({ eventId: plan.eventId, field, reason: "combined date range would be invalid" });
      }
      continue;
    }
    validPlans.push(plan);
  }

  return { plans: validPlans, skipped };
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "ZyniVerseConventionAutoSync/1.0" },
    });
    return response.ok || response.status === 405;
  } catch {
    return false;
  }
}

function toWatchRow(row: {
  id: string;
  name: string;
  city: string;
  state: string;
  venue: string;
  website: string;
  ticketUrl: string | null;
  image: string | null;
  startDate: Date;
  endDate: Date;
  organizers: string[];
  tags: string[];
  isPublic: boolean;
  status: string;
}): ConventionWatchRow {
  return { ...row };
}

let inflight: Promise<ConventionAutoSyncResult> | null = null;

async function runSync(): Promise<ConventionAutoSyncResult> {
  const checkedAt = new Date().toISOString();
  const today = getIndiaDateKey(new Date(checkedAt));

  const dbRows = await prisma.convention.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      venue: true,
      website: true,
      ticketUrl: true,
      image: true,
      startDate: true,
      endDate: true,
      organizers: true,
      tags: true,
      isPublic: true,
      status: true,
    },
    orderBy: { startDate: "asc" },
  });
  const rows = selectPublicWatchRows(dbRows.map(toWatchRow), checkedAt);

  // No news feeds or discovery sites are passed in: they can never write here.
  const queue = await buildConventionReview({
    rows,
    fetchPage: defaultFetchPage,
    checkedAt,
  });

  const approvedQueue: ConventionReviewQueue = {
    ...queue,
    proposals: queue.proposals.map((proposal) => ({ ...proposal, decision: "approved" })),
  };
  const patches = buildApprovedPatches(approvedQueue, rows);

  const reachablePatches: ApprovedPatch[] = [];
  const skipped: AutoSyncSkip[] = [];
  for (const patch of patches) {
    if (patch.field === "image" || patch.field === "ticketUrl") {
      if (!(await isReachable(patch.value))) {
        skipped.push({ eventId: patch.eventId, field: patch.field, reason: "official URL is not reachable" });
        continue;
      }
    }
    reachablePatches.push(patch);
  }

  const { plans, skipped: rangeSkips } = buildAutoUpdatePlans(reachablePatches, rows, today);
  skipped.push(...rangeSkips);

  const applied: ConventionAutoSyncResult["applied"] = [];
  for (const plan of plans) {
    const sourceIds = reachablePatches
      .filter((patch) => patch.eventId === plan.eventId)
      .map((patch) => patch.proposal.sourceId);

    const result = await prisma.convention.updateMany({
      where: { id: plan.eventId, isPublic: true },
      data: plan.data as Prisma.ConventionUpdateManyMutationInput,
    });
    if (result.count > 0) {
      applied.push({ eventId: plan.eventId, fields: Object.keys(plan.data), sourceIds: [...new Set(sourceIds)] });
    } else {
      skipped.push({ eventId: plan.eventId, field: "row", reason: "row became non-public before write" });
    }
  }

  return {
    success: true,
    checkedAt,
    reviewed: rows.length,
    proposals: queue.proposals.length,
    applied,
    skipped,
    notes: queue.notes.length,
    errors: queue.errors,
  };
}

/** One sync per process, even if two cron callers overlap. */
export function syncConventionSources(): Promise<ConventionAutoSyncResult> {
  if (!inflight) {
    inflight = runSync().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
