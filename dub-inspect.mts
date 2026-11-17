import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.dubCatalogTitle.findMany({
    where: { source: "desidubanime", languages: { isEmpty: true } },
    take: 10,
    select: { sourceId: true, slug: true, sourceUrl: true, title: true },
  });
  console.log("empty-language rows:", await prisma.dubCatalogTitle.count({ where: { source: "desidubanime", languages: { isEmpty: true } } }));
  console.log(rows);
  const sample = await prisma.dubCatalogTitle.findMany({
    where: { source: "animedubhindi" },
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: { title: true, kind: true, languages: true, year: true, season: true },
  });
  console.log("ADH sample:", sample);
}

main().finally(() => prisma.$disconnect());
