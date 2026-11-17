import { prisma } from "@/lib/prisma";
import { getDubLanguages, getDubStats } from "@/lib/dub-import/queries";

async function main() {
  const empty = await prisma.dubCatalogTitle.count({ where: { languages: { isEmpty: true } } });
  const langs = await getDubLanguages();
  const stats = await getDubStats();
  console.log("empty languages:", empty);
  console.log("stats:", { total: stats.total, series: stats.series, movies: stats.movies, schedule: stats.scheduleCount, languages: stats.languages });
  console.log(langs);
  console.log(stats.sources.map((s) => ({ id: s.id, count: s.itemCount, status: s.status })));
}

main().finally(() => prisma.$disconnect());
