import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.dubScheduleEntry.findMany({ take: 5 });
  console.log(
    rows.map((r) => ({
      title: r.title,
      day: r.dayLabel,
      time: r.timeLabel,
      releaseAt: r.releaseAt,
      langs: r.languages,
      season: r.season,
      ep: r.episodeInfo,
    }))
  );
  const days = await prisma.dubScheduleEntry.groupBy({ by: ["dayLabel"], _count: { _all: true } });
  console.log(days);
}

main().finally(() => prisma.$disconnect());
