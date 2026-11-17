import { prisma } from "@/lib/prisma";

async function main() {
  const t0 = Date.now();
  const rows = await prisma.dubCatalogTitle.findMany({ take: 12 });
  console.log("read 12:", Date.now() - t0, "ms");

  const t1 = Date.now();
  await Promise.all(
    rows.map((row) =>
      prisma.dubCatalogTitle.update({ where: { id: row.id }, data: { updatedAt: new Date() } })
    )
  );
  console.log("12 parallel updates:", Date.now() - t1, "ms");

  const t2 = Date.now();
  for (const row of rows.slice(0, 3)) {
    await prisma.dubCatalogTitle.update({ where: { id: row.id }, data: { updatedAt: new Date() } });
  }
  console.log("3 sequential updates:", Date.now() - t2, "ms");
}

main().finally(() => prisma.$disconnect());
