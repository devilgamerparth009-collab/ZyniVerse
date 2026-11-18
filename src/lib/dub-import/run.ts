/**
 * Chunked sync runner shared by `/api/dub/sync` (manual) and
 * `/api/cron/dub-sync` (Vercel/GitHub cron). It keeps calling `syncDubSource`
 * until every stage reports `nextQuery: null` or the wall-clock budget is
 * spent, so a single serverless invocation still makes useful progress.
 *
 * Catalogue and schedule are separate stages. The schedule stage is attempted
 * on every fresh invocation *before* the catalogue, so a dead WordPress API
 * can no longer starve the weekly airing table. A resumed invocation (one
 * carrying a `cursor`) skips the schedule stage because it already ran on the
 * first chunk.
 */
import { DUB_SOURCES, DubSourceId } from "./sources";
import { syncDubSource, SyncResult, SyncStage, StageStatus } from "./sync";

export interface RunOptions {
  source?: string | null;
  mode?: "full" | "incremental";
  limit?: number;
  cursor?: string | null;
  /** Keep looping until done / budget spent instead of a single chunk. */
  loop?: boolean;
  budgetMs?: number;
  /** Run only one stage; omit / "all" to run both where supported. */
  stage?: SyncStage | "all";
}

export interface StageSummary {
  stage: SyncStage;
  status: StageStatus | "skipped";
  fetched: number;
  upserted: number;
  errors: string[];
  chunks: number;
  done: boolean;
  nextQuery: string | null;
  message: string;
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
  /** Per-stage view; a failed catalogue never masks a healthy schedule. */
  stages: StageSummary[];
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

function wantsStage(requested: SyncStage | "all" | undefined, stage: SyncStage): boolean {
  return !requested || requested === "all" || requested === stage;
}

function stagesFor(source: DubSourceId): SyncStage[] {
  // Schedule first: it is a single fetch and must not be crowded out by a
  // catalogue crawl that consumes the whole function budget.
  return DUB_SOURCES[source].schedulePath
    ? ["schedule", "catalogue"]
    : ["catalogue"];
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
  const isResume = Boolean(options.cursor);

  for (const source of sources) {
    const stageSummaries: StageSummary[] = [];

    for (const stage of stagesFor(source)) {
      if (!wantsStage(options.stage, stage)) continue;

      if (stage === "schedule" && isResume && options.stage !== "schedule") {
        stageSummaries.push({
          stage,
          status: "skipped",
          fetched: 0,
          upserted: 0,
          errors: [],
          chunks: 0,
          done: true,
          nextQuery: null,
          message: "Schedule already refreshed in the first chunk of this chain.",
        });
        continue;
      }

      let cursor = stage === "schedule" ? null : (options.cursor ?? null);
      let chunks = 0;
      let fetched = 0;
      let upserted = 0;
      const errors: string[] = [];
      let nextQuery: string | null = null;
      let message = "";
      let done = false;
      let status: StageStatus = "ok";

      do {
        if (chunks > 0 && Date.now() - startedAt > budgetMs) break;
        try {
          const result: SyncResult = await syncDubSource(source, {
            mode,
            limit: options.limit,
            cursor,
            stage,
          });
          chunks += 1;
          fetched += result.fetched;
          upserted += result.upserted;
          errors.push(...result.errors);
          if (result.status === "error") status = "error";
          nextQuery = result.nextQuery;
          message = result.message;
          done = !result.nextQuery;
          cursor = cursorFrom(result.nextQuery);
        } catch (error) {
          chunks += 1;
          status = "error";
          errors.push((error as Error).message);
          message = `${source}/${stage}: sync failed — ${(error as Error).message}`;
          nextQuery = null;
          done = true;
        }
      } while (options.loop && !done && Date.now() - startedAt < budgetMs);

      stageSummaries.push({
        stage,
        status,
        fetched,
        upserted,
        errors,
        chunks,
        done,
        nextQuery,
        message,
      });
    }

    const catalogue = stageSummaries.find((s) => s.stage === "catalogue");
    summaries.push({
      source,
      mode,
      fetched: stageSummaries.reduce((sum, s) => sum + s.fetched, 0),
      upserted: stageSummaries.reduce((sum, s) => sum + s.upserted, 0),
      errors: stageSummaries.flatMap((s) => s.errors),
      chunks: stageSummaries.reduce((sum, s) => sum + s.chunks, 0),
      // The workflow resumes the catalogue chain only; schedule is a single
      // self-contained fetch on the first invocation.
      nextQuery: catalogue?.nextQuery ?? null,
      done: stageSummaries.filter((s) => s.status !== "skipped").every((s) => s.done),
      message: stageSummaries.map((s) => s.message).filter(Boolean).join(" "),
      stages: stageSummaries,
    });

    if (Date.now() - startedAt > budgetMs) break;
  }

  return {
    sources: summaries,
    elapsedMs: Date.now() - startedAt,
    done:
      summaries.length === sources.length && summaries.every((s) => s.done),
  };
}
