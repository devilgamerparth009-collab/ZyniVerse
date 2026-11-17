import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function main() {
  const langs = ["Hindi", "Tamil"];
  const id = "test-raw-" + Date.now();
  await prisma.$executeRaw`
    INSERT INTO "DubCatalogTitle" ("id","source","sourceId","sourceUrl","slug","title","kind","posterUrl","languages","genres","season","episodeInfo","description","year","rating","lastModified","firstSeenAt","updatedAt")
    VALUES (${id}, ${"rawtest"}, ${id}, ${"https://example.com"}, ${id}, ${"Raw Test"}, ${"series"}, ${null}, ${langs}, ${[]}, ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, now(), now())
    ON CONFLICT ("source","sourceId") DO UPDATE SET "title" = EXCLUDED."title", "languages" = EXCLUDED."languages", "updatedAt" = now()
  `;
  const row = await prisma.dubCatalogTitle.findUnique({ where: { source_sourceId: { source: "rawtest", sourceId: id } } });
  console.log(row?.languages);
  await prisma.dubCatalogTitle.delete({ where: { source_sourceId: { source: "rawtest", sourceId: id } } });
  console.log("deleted ok");
}

main().finally(() => prisma.$disconnect());
