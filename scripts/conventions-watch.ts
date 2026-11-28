// Local review tool for convention facts.
//
// It never writes to the database in review mode. `--apply` only writes fields
// that a human has marked approved in the generated review file, and only if
// the stored value still matches the reviewed snapshot.
//
//   npx tsx scripts/conventions-watch.ts
//   npx tsx scripts/conventions-watch.ts --apply data/convention-review/latest.json

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";
import {
  buildApprovedPatches,
  buildConventionReview,
  collectNewsNotes,
  defaultFetchPage,
  NEWS_FEEDS,
  selectPublicWatchRows,
  type ConventionReviewQueue,
  type ConventionWatchRow,
  type NewsItem,
  type ReviewNote,
  type SourceDefinition,
} from "../src/lib/convention-sources";

const prisma = new PrismaClient();
const OUTPUT_DIR = path.join(process.cwd(), "data", "convention-review");

interface RssItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  pubDate?: string;
  isoDate?: string;
}

function parseArgs(argv: string[]): { mode: "review" } | { mode: "apply"; file: string } {
  if (argv[0] === "--apply") {
    if (!argv[1]) throw new Error("--apply needs a review JSON file path");
    return { mode: "apply", file: argv[1] };
  }
  if (argv.length > 0 && argv[0] !== "--help") {
    throw new Error(`Unknown arguments: ${argv.join(" ")}`);
  }
  return { mode: "review" };
}

async function loadWatchRows(): Promise<ConventionWatchRow[]> {
  const rows = await prisma.convention.findMany({
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

  // Hidden legacy rows never enter the watcher, even if a review file names them.
  return rows.filter((row) => row.isPublic === true);
}

async function collectNews(
  rows: ConventionWatchRow[],
  checkedAt: string
): Promise<{ notes: ReviewNote[]; errors: ConventionReviewQueue["errors"] }> {
  const parser = new Parser<Record<string, never>, RssItem>();
  const feeds: Array<{ feed: SourceDefinition; items: NewsItem[] }> = [];
  const errors: ConventionReviewQueue["errors"] = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items: NewsItem[] = (parsed.items ?? []).slice(0, 60).map((item) => ({
        title: item.title ?? "",
        link: item.link ?? "",
        description: item.contentSnippet ?? item.content,
        publishedAt: item.isoDate ?? item.pubDate,
      })).filter((item) => item.title.length > 0);
      feeds.push({ feed, items });
    } catch (error) {
      errors.push({ eventId: null, sourceId: feed.id, message: String(error) });
    }
  }

  return { notes: collectNewsNotes(rows, feeds, checkedAt), errors };
}

function formatReviewMarkdown(queue: ConventionReviewQueue): string {
  const lines: string[] = [
    `# Convention source review — ${queue.generatedAt}`,
    "",
    "**Review only. No database writes were made.** News feeds and discovery sites never publish fields.",
    "",
    "## Field ownership",
    "",
    "| Source | Kind | Can write | Advisory only |",
    "| --- | --- | --- | --- |",
  ];

  for (const source of queue.policy) {
    lines.push(
      `| ${source.label} | ${source.kind} | ${source.authoritativeFor.join(", ") || "—"} | ${source.advisoryFor.join(", ") || "—"} |`
    );
  }

  lines.push("", "## Proposed changes", "");
  if (queue.proposals.length === 0) {
    lines.push("No source field differs from the stored record.");
  } else {
    for (const proposal of queue.proposals) {
      lines.push(
        `- **${proposal.eventId} · ${proposal.field}**: \`${proposal.currentValue ?? "null"}\` → \`${proposal.proposedValue}\` ` +
          `via ${proposal.sourceLabel} (${proposal.sourceUrl}). Decision: **${proposal.decision}**.`
      );
    }
  }

  lines.push("", "## Review notes", "");
  if (queue.notes.length === 0) {
    lines.push("None.");
  } else {
    for (const note of queue.notes) {
      const target = note.eventId ? `**${note.eventId}** — ` : "";
      const detail = note.detailUrl ? ` (${note.detailUrl})` : "";
      lines.push(`- ${target}${note.message}${detail}`);
    }
  }

  lines.push("", "## Source errors", "");
  if (queue.errors.length === 0) {
    lines.push("None.");
  } else {
    for (const error of queue.errors) {
      lines.push(`- ${error.eventId ?? "global"} · ${error.sourceId}: ${error.message}`);
    }
  }

  lines.push(
    "",
    "To publish a reviewed change, set `decision` to `approved` in the JSON file and rerun with `--apply <file>`.",
    ""
  );
  return lines.join("\n");
}

async function runReview(): Promise<void> {
  const checkedAt = new Date().toISOString();
  const allPublicRows = await loadWatchRows();
  const rows = selectPublicWatchRows(allPublicRows, checkedAt);
  const news = await collectNews(rows, checkedAt);
  const queue = await buildConventionReview({
    rows,
    newsNotes: news.notes,
    fetchPage: defaultFetchPage,
    checkedAt,
  });
  queue.errors.push(...news.errors);
  queue.errors.sort((a, b) => (a.eventId ?? "").localeCompare(b.eventId ?? ""));

  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "latest.json");
  const markdownPath = path.join(OUTPUT_DIR, "latest.md");
  await writeFile(jsonPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, formatReviewMarkdown(queue), "utf8");

  console.log(
    `Reviewed ${rows.length} public active conventions: ${queue.proposals.length} proposed field change(s), ` +
      `${queue.notes.length} note(s), ${queue.errors.length} source error(s).`
  );
  console.log(`Review files: ${jsonPath}`);
  console.log(`              ${markdownPath}`);
  console.log("No database writes were made.");
}

async function runApply(file: string): Promise<void> {
  const raw = await readFile(path.resolve(file), "utf8");
  const queue = JSON.parse(raw) as ConventionReviewQueue;
  if (queue.mode !== "review-only") {
    throw new Error("Refusing to apply a file that is not a review-only queue");
  }

  const rows = await loadWatchRows();
  const patches = buildApprovedPatches(queue, rows);
  if (patches.length === 0) {
    console.log("No valid approved patches. Nothing was written.");
    return;
  }

  let applied = 0;
  for (const patch of patches) {
    const data =
      patch.field === "startDate" || patch.field === "endDate"
        ? { [patch.field]: new Date(`${patch.value}T00:00:00Z`) }
        : { [patch.field]: patch.value };

    // The isPublic condition is a second guard against touching hidden rows.
    const result = await prisma.convention.updateMany({
      where: { id: patch.eventId, isPublic: true },
      data,
    });
    applied += result.count;
    console.log(`${result.count > 0 ? "Applied" : "Skipped"} ${patch.eventId}.${patch.field} from ${patch.proposal.sourceId}`);
  }
  console.log(`Applied ${applied} of ${patches.length} approved field change(s).`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "review") {
    await runReview();
  } else {
    await runApply(args.file);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // RSS/fetch clients can leave keep-alive sockets open on Windows. The work
    // is already flushed, so a CLI run should not wait on those handles.
    process.exit(process.exitCode ?? 0);
  });
