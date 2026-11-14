#!/usr/bin/env node
/**
 * Prune high-churn cache / analytics / log tables and reclaim bloat.
 *
 * These tables account for ~86% of the database size but hold no
 * irreplaceable data (API caches, session telemetry, ad/view logs).
 *
 * SAFETY: dry-run by default. Nothing is deleted unless you pass --commit.
 *
 * Usage:
 *   node scripts/prune-cache.mjs                     # dry-run
 *   node scripts/prune-cache.mjs --commit            # delete + reclaim
 *   node scripts/prune-cache.mjs --commit --vacuum-full   # also compact tables
 *   node scripts/prune-cache.mjs --commit --reindex       # rebuild bloated indexes
 *   node scripts/prune-cache.mjs --days=60           # override retention
 *   node scripts/prune-cache.mjs --skip=cache        # keep AniListCache intact
 *
 * Env: DATABASE_URL / DIRECT_URL from .env (DIRECT_URL preferred — bulk deletes
 * on a session connection behave better than through pgbouncer).
 */

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const vacuumFull = args.includes("--vacuum-full");
const reindex = args.includes("--reindex");
const skip = (args.find((a) => a.startsWith("--skip="))?.split("=")[1] || "").split(",").filter(Boolean);
const daysArg = args.find((a) => a.startsWith("--days="));
const globalDays = daysArg ? Number(daysArg.split("=")[1]) : null;

if (daysArg && (!Number.isFinite(globalDays) || globalDays <= 0)) {
  console.error("Invalid --days value:", daysArg);
  process.exit(1);
}

const rawConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!rawConnectionString) {
  console.error("DIRECT_URL / DATABASE_URL missing. Create .env first.");
  process.exit(1);
}

// `pg` v8 treats sslmode=require as verify-full, which fails against the
// Supabase pooler's self-signed chain. Drop it and use rejectUnauthorized:false
// explicitly (same trust level Prisma uses for these connections).
const connectionString = (() => {
  try {
    const url = new URL(rawConnectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return rawConnectionString;
  }
})();

/**
 * `where` is a SQL predicate. `days` is used for the "older than N days" hint
 * and can be overridden by --days. `truncate` empties the whole table (only for
 * pure caches).
 */
const targets = [
  {
    table: "AniListCache",
    kind: "cache",
    truncate: true,
    note: "pure API cache — refills on demand",
  },
  {
    table: "AiCache",
    kind: "cache",
    days: 7,
    where: `"createdAt" < now() - interval '7 days'`,
    note: "AI response cache",
  },
  {
    table: "SiteCounter",
    kind: "telemetry",
    days: 7,
    where: `key like 'bot:path:%' and "updatedAt" < now() - interval '7 days'`,
    note: "bot crawler path counters (ElevenlabsCrawler etc.)",
  },
  {
    table: "AdImpression",
    kind: "log",
    days: 30,
    where: `"createdAt" < now() - interval '30 days'`,
    note: "ad impressions log",
  },
  {
    table: "PageView",
    kind: "log",
    days: 90,
    where: `"createdAt" < now() - interval '90 days'`,
    note: "analytics page views",
  },
  {
    table: "UserActivity",
    kind: "log",
    days: 90,
    where: `"createdAt" < now() - interval '90 days'`,
    note: "activity feed log",
  },
  {
    table: "UserSession",
    kind: "telemetry",
    days: 30,
    where: `"lastActiveAt" < now() - interval '30 days'`,
    note: "stale visitor sessions",
  },
  {
    table: "PodcastCache",
    kind: "cache",
    days: 30,
    where: `"updatedAt" < now() - interval '30 days'`,
    note: "podcast cache",
  },
  {
    table: "MangaDexCache",
    kind: "cache",
    days: 60,
    where: `"updatedAt" < now() - interval '60 days'`,
    note: "MangaDex cache",
  },
];

const BATCH = 5000;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();
console.log(commit ? "MODE: COMMIT (will modify the database)\n" : "MODE: DRY-RUN (nothing will be deleted)\n");

const fmt = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const sizeOf = async (table) => {
  const r = await client.query(
    "select coalesce(pg_total_relation_size(to_regclass($1)), 0)::bigint b",
    [`public."${table}"`]
  );
  return Number(r.rows[0].b);
};

const dbBefore = Number(
  (await client.query("select pg_database_size(current_database())::bigint b")).rows[0].b
);
console.log(`DB size before: ${fmt(dbBefore)}\n`);

let totalDeleted = 0;
const touched = [];
let reclaimable = 0;

for (const t of targets) {
  if (skip.includes(t.kind) || skip.includes(t.table)) {
    console.log(`  ${t.table.padEnd(18)} skipped (--skip)`);
    continue;
  }

  const before = await sizeOf(t.table);
  const where = t.truncate
    ? "true"
    : globalDays
      ? t.where.replace(/interval '\d+ days'/, `interval '${globalDays} days'`)
      : t.where;

  let matched;
  try {
    matched = (await client.query(`select count(*)::int n from "${t.table}" where ${where}`)).rows[0].n;
  } catch (err) {
    console.log(`  ${t.table.padEnd(18)} SKIP (${err.message.slice(0, 60)})`);
    continue;
  }

  const label = t.truncate ? "ALL rows" : `${matched.toLocaleString()} rows`;

  if (!commit) {
    console.log(`  ${t.table.padEnd(18)} ${label.padStart(12)}  ${fmt(before).padStart(8)}  — ${t.note}`);
    totalDeleted += matched;
    if (matched > 0) reclaimable += before;
    continue;
  }

  let deleted = 0;
  if (t.truncate) {
    await client.query(`truncate table "${t.table}"`);
    deleted = matched;
  } else {
    for (;;) {
      const res = await client.query(
        `delete from "${t.table}"
           where ctid in (select ctid from "${t.table}" where ${where} limit ${BATCH})`
      );
      deleted += res.rowCount;
      if (res.rowCount < BATCH) break;
      process.stdout.write(`\r  ${t.table.padEnd(18)} deleted ${deleted}...`);
    }
  }

  const after = await sizeOf(t.table);
  console.log(
    `\r  ${t.table.padEnd(18)} deleted ${String(deleted).padStart(9)}  ${fmt(before).padStart(8)} -> ${fmt(after).padEnd(8)}`
  );
  totalDeleted += deleted;
  touched.push(t.table);
}

console.log("");

if (!commit) {
  console.log(`Would free ~${fmt(reclaimable)} (${totalDeleted.toLocaleString()} rows).`);
  console.log("Re-run with --commit to apply.\n");
} else {
  console.log(`Deleted ${totalDeleted.toLocaleString()} rows from ${touched.length} tables.`);

  if (reindex) {
    console.log("REINDEX (rebuilds bloated indexes)...");
    for (const t of targets) {
      if (skip.includes(t.kind) || skip.includes(t.table)) continue;
      try {
        await client.query(`reindex table "${t.table}"`);
        console.log(`  ${t.table} reindexed`);
      } catch (err) {
        console.log(`  ${t.table} reindex failed: ${err.message.slice(0, 60)}`);
      }
    }
  }

  if (vacuumFull) {
    console.log("VACUUM FULL (brief table lock)...");
    for (const t of targets) {
      if (skip.includes(t.kind) || skip.includes(t.table)) continue;
      try {
        await client.query(`vacuum full "${t.table}"`);
        console.log(`  ${t.table} compacted`);
      } catch (err) {
        console.log(`  ${t.table} VACUUM FULL failed: ${err.message.slice(0, 60)}`);
      }
    }
  } else {
    for (const table of touched) {
      try {
        await client.query(`vacuum (analyze) "${table}"`);
      } catch {}
    }
  }
}

const dbAfter = Number(
  (await client.query("select pg_database_size(current_database())::bigint b")).rows[0].b
);
console.log(`\nDB size after:  ${fmt(dbAfter)}  (saved ${fmt(dbBefore - dbAfter)})`);

await client.end();
