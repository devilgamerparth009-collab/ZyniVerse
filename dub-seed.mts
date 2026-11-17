import { runDubSync } from "@/lib/dub-import/run";
import { prisma } from "@/lib/prisma";

async function main() {
  const mode = (process.env.SYNC_MODE as "full" | "incremental") ?? "full";
  const source = process.env.SYNC_SOURCE ?? "all";
  const cursor = process.env.SYNC_CURSOR ?? null;
  let round = 0;

  for (;;) {
    round += 1;
    const result = await runDubSync({ source, mode, cursor, loop: true, budgetMs: 240000 });
    for (const s of result.sources) {
      console.log(
        `[round ${round}] ${s.source} chunks=${s.chunks} fetched=${s.fetched} upserted=${s.upserted} done=${s.done} errors=${s.errors.length}`
      );
      if (s.errors.length) console.log("  first error:", s.errors[0]);
      if (s.nextQuery) console.log("  next:", s.nextQuery);
    }
    if (result.done || round >= 12) break;
  }

  const [titles, series, movies, schedule, states] = await Promise.all([
    prisma.dubCatalogTitle.count(),
    prisma.dubCatalogTitle.count({ where: { kind: "series" } }),
    prisma.dubCatalogTitle.count({ where: { kind: "movie" } }),
    prisma.dubScheduleEntry.count(),
    prisma.dubSourceState.findMany(),
  ]);

  console.log("--- DB ---");
  console.log({ titles, series, movies, schedule });
  console.log(states);

  const sample = await prisma.dubCatalogTitle.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: { source: true, title: true, kind: true, languages: true, posterUrl: true },
  });
  console.log(sample);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
