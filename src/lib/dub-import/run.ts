/**
 * Chunked sync runner shared by `/api/dub/sync` (manual) and
 * `/api/cron/dub-sync` (daily). It keeps calling `syncDubSource` until every
 * source reports `nextQuery: null` or the wall-clock budget is spent, so a
 * single serverless invocation still makes useful progress on a full crawl.
 */
import { DUB_SOURCES, DubSourceId } from "./sources";
import { syncDubSource, SyncResult } from "./sync";

export interface RunOptions {
  source?: string | null;
  mode?: "full" | "incremental";
  limit?: number;
  cursor?: string | null;
  /** Keep looping until done / budget spent instead of a single chunk. */
  loop?: boolean;
  budgetMs?: number;
}

export interface RunSummary {
  source: DubSourceId;
  mode: "full" | "incremental";
  fetched: number;
  upserted: number;
  errors: string[];
  chunks: number;
  done: boolean;
  nextQuery: string | null;
  message: string;
}

function cursorFrom(nextQuery: string | null): string | null {
  if (!nextQuery) return null;
  const match = nextQuery.match(/(?:^|&)cursor=([^&]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function resolveSources(source: string | null | undefined): DubSourceId[] {
  if (!source || source === "all") return Object.keys(DUB_SOURCES) as DubSourceId[];
  if (DUB_SOURCES[source as DubSourceId]) return [source as DubSourceId];
  return Object.keys(DUB_SOURCES) as DubSourceId[];
}

export async function runDubSync(options: RunOptions = {}): Promise<{
  sources: RunSummary[];
  elapsedMs: number;
  done: boolean;
}> {
  const startedAt = Date.now();
  const budgetMs = Math.max(5000, options.budgetMs ?? 45000);
  const mode = options.mode ?? "incremental";
  const sources = resolveSources(options.source);
  const summaries: RunSummary[] = [];

  for (const source of sources) {
    let cursor = options.cursor ?? null;
    let chunks = 0;
    let fetched = 0;
    let upserted = 0;
    const errors: string[] = [];
    let nextQuery: string | null = null;
    let message = "";
    let done = false;

    do {
      if (Date.now() - startedAt > budgetMs) break;
      try {
        const result: SyncResult = await syncDubSource(source, {
          mode,
          limit: options.limit,
          cursor,
        });
        chunks += 1;
        fetched += result.fetched;
        upserted += result.upserted;
        errors.push(...result.errors);
        nextQuery = result.nextQuery;
        message = result.message;
        done = !result.nextQuery;
        cursor = cursorFrom(result.nextQuery);
      } catch (error) {
        chunks += 1;
        errors.push((error as Error).message);
        message = `${source}: sync failed — ${(error as Error).message}`;
        nextQuery = null;
        done = true;
      }
    } while (options.loop && !done && Date.now() - startedAt < budgetMs);

    summaries.push({
      source,
      mode,
      fetched,
      upserted,
      errors,
      chunks,
      done,
      nextQuery,
      message,
    });

    if (Date.now() - startedAt > budgetMs) break;
  }

  return {
    sources: summaries,
    elapsedMs: Date.now() - startedAt,
    done: summaries.length === sources.length && summaries.every((s) => s.done),
  };
}
