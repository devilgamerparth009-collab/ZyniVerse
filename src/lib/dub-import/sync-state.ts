/**
 * Per-stage sync bookkeeping for the dub importer.
 *
 * `DubSourceState` only has one `lastSyncAt` / `status` pair for a whole source,
 * which used to let a failed catalogue fetch look like a successful schedule
 * refresh (and vice versa). Stages now get their own state record:
 *
 *   - `cursor` and `lastSyncAt` are ONLY advanced when the stage actually
 *     fetched and wrote data successfully;
 *   - a failed stage keeps its previous cursor, so the next cron tick retries
 *     from the last good position;
 *   - the durable table is created on demand (this repo does not own a
 *     migration for it). If DDL is not permitted, an in-process map keeps the
 *     same semantics for the current serverless instance and the stage result
 *     is still reported in the cron response.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DubSourceId } from "./sources";

export type SyncStage = "catalogue" | "schedule";
export type StageStatus = "ok" | "error";

export interface StageState {
  source: DubSourceId;
  stage: SyncStage;
  status: StageStatus;
  cursor: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  lastFetched: number;
  updatedAt: Date;
}

const memory = new Map<string, StageState>();
let tableReady: Promise<boolean> | null = null;

function keyOf(source: DubSourceId, stage: SyncStage): string {
  return `${source}:${stage}`;
}

async function ensureTable(): Promise<boolean> {
  if (!tableReady) {
    tableReady = (async () => {
      try {
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "DubSyncStageState" (
            "source" TEXT NOT NULL,
            "stage" TEXT NOT NULL,
            "status" TEXT NOT NULL,
            "cursor" TEXT,
            "lastSyncAt" TIMESTAMP(3),
            "lastError" TEXT,
            "lastFetched" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
            PRIMARY KEY ("source", "stage")
          )
        `;
        return true;
      } catch {
        return false;
      }
    })();
  }
  return tableReady;
}

interface StageRow {
  source: string;
  stage: string;
  status: string;
  cursor: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  lastFetched: number;
  updatedAt: Date;
}

function fromRow(row: StageRow): StageState {
  return {
    source: row.source as DubSourceId,
    stage: row.stage as SyncStage,
    status: row.status === "ok" ? "ok" : "error",
    cursor: row.cursor,
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
    lastFetched: row.lastFetched,
    updatedAt: row.updatedAt,
  };
}

export async function readStageState(
  source: DubSourceId,
  stage: SyncStage
): Promise<StageState | null> {
  const key = keyOf(source, stage);
  if (!(await ensureTable())) return memory.get(key) ?? null;
  try {
    const rows = await prisma.$queryRaw<StageRow[]>(Prisma.sql`
      SELECT "source", "stage", "status", "cursor", "lastSyncAt", "lastError", "lastFetched", "updatedAt"
      FROM "DubSyncStageState"
      WHERE "source" = ${source} AND "stage" = ${stage}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return memory.get(key) ?? null;
    const state = fromRow(row);
    memory.set(key, state);
    return state;
  } catch {
    return memory.get(key) ?? null;
  }
}

export interface StageUpdate {
  status: StageStatus;
  /** Candidate cursor for this stage; only stored when `advance` is true. */
  cursor?: string | null;
  error?: string | null;
  fetched?: number;
  /** True only when real data was fetched and written by this stage. */
  advance: boolean;
}

export async function writeStageState(
  source: DubSourceId,
  stage: SyncStage,
  update: StageUpdate
): Promise<StageState> {
  const prev = await readStageState(source, stage);
  const now = new Date();
  const next: StageState = {
    source,
    stage,
    status: update.status,
    cursor: update.advance ? (update.cursor ?? null) : (prev?.cursor ?? null),
    lastSyncAt: update.advance ? now : (prev?.lastSyncAt ?? null),
    lastError: update.status === "ok" ? null : (update.error ?? prev?.lastError ?? null),
    lastFetched: update.advance
      ? (update.fetched ?? 0)
      : (prev?.lastFetched ?? 0),
    updatedAt: now,
  };

  memory.set(keyOf(source, stage), next);
  if (!(await ensureTable())) return next;
  try {
    await prisma.$executeRaw`
      INSERT INTO "DubSyncStageState"
        ("source", "stage", "status", "cursor", "lastSyncAt", "lastError", "lastFetched", "updatedAt")
      VALUES
        (${source}, ${stage}, ${next.status}, ${next.cursor}, ${next.lastSyncAt},
         ${next.lastError}, ${next.lastFetched}, ${next.updatedAt})
      ON CONFLICT ("source", "stage") DO UPDATE SET
        "status" = EXCLUDED."status",
        "cursor" = EXCLUDED."cursor",
        "lastSyncAt" = EXCLUDED."lastSyncAt",
        "lastError" = EXCLUDED."lastError",
        "lastFetched" = EXCLUDED."lastFetched",
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  } catch {
    // Bookkeeping must never fail a sync; the in-memory record still stands.
  }
  return next;
}
