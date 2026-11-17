import { prisma } from "@/lib/prisma";

async function main() {
  const [titles, schedule, states] = await Promise.all([
    prisma.dubCatalogTitle.count(),
    prisma.dubScheduleEntry.count(),
    prisma.dubSourceState.findMany(),
  ]);
  console.log({ titles, schedule });
  console.log(states);
  const sample = await prisma.dubCatalogTitle.findMany({
    take: 3,
    orderBy: { updatedAt: "desc" },
    select: { source: true, title: true, kind: true, languages: true },
  });
  console.log(sample);
}

main().finally(() => prisma.$disconnect());
