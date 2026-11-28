import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Curated event listings only.
 *
 * Attendance and announcements are intentionally absent: there is no free
 * authoritative feed for them. The daily /api/cron/events-refresh route checks
 * official event schemas and year-specific Wikipedia venue notes, and removes
 * any unsourced facts that may already exist in the database.
 *
 * AnimeJapan 2027 at INTEX Osaka is verified on https://anime-japan.jp/en/.
 */
const ANIME_EVENTS_SEED = [
  {
    slug: "anime-expo-2026",
    name: "Anime Expo 2026",
    shortName: "AX 2026",
    type: "expo",
    location: "Los Angeles Convention Center, Los Angeles, CA",
    country: "USA",
    startDate: new Date("2026-07-02"),
    endDate: new Date("2026-07-05"),
    website: "https://www.anime-expo.org",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21612-d5zrx9CWkxNl.png",
    description:
      "North America's largest anime convention, with four days of panels, cosplay, industry exhibits, and studio programming.",
    attendance: null,
    tags: ["expo", "premiere", "panels", "cosplay", "industry"],
  },
  {
    slug: "jump-festa-2027",
    name: "Jump Festa 2027",
    shortName: "JF 2027",
    type: "festival",
    location: "Makuhari Messe, Chiba, Japan",
    country: "Japan",
    startDate: new Date("2026-12-19"),
    endDate: new Date("2026-12-20"),
    website: "https://www.jumpfesta.com",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg",
    description:
      "Shueisha's annual manga and anime festival, covering Weekly Shonen Jump titles and stage programming.",
    attendance: null,
    tags: ["jump", "shonen", "manga", "anime-reveal", "exclusive"],
  },
  {
    slug: "otakon-2026",
    name: "Otakon 2026",
    shortName: "Otakon",
    type: "convention",
    location: "Walter E. Washington Convention Center, Washington, D.C.",
    country: "USA",
    startDate: new Date("2026-07-31"),
    endDate: new Date("2026-08-02"),
    website: "https://otakon.com",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png",
    description:
      "A long-running East Coast anime convention celebrating East Asian pop culture with panels, cosplay, concerts, and industry guests.",
    attendance: null,
    tags: ["washington-dc", "east-coast", "anime", "cosplay", "panels"],
  },
  {
    slug: "sdcc-2026-anime",
    name: "San Diego Comic-Con 2026 — Anime Section",
    shortName: "SDCC 2026",
    type: "convention",
    location: "San Diego Convention Center, San Diego, CA",
    country: "USA",
    startDate: new Date("2026-07-23"),
    endDate: new Date("2026-07-26"),
    website: "https://www.comic-con.org",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg",
    description:
      "A major pop-culture convention with a large anime presence, industry panels, and studio programming.",
    attendance: null,
    tags: ["comic-con", "hollywood", "anime", "panels", "exclusive"],
  },
  {
    slug: "anime-japan-2027",
    name: "AnimeJapan 2027",
    shortName: "AJ 2027",
    type: "festival",
    location: "INTEX Osaka, Osaka, Japan",
    country: "Japan",
    startDate: new Date("2027-03-26"),
    endDate: new Date("2027-03-28"),
    website: "https://anime-japan.jp",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-Kb6R5nYQfjmP.jpg",
    description:
      "Japan's premier anime event moves to INTEX Osaka for 2027. Business days run March 26-27 with public days on March 27-28.",
    attendance: null,
    tags: ["anime-japan", "osaka", "industry", "premiere", "manga"],
  },
  {
    slug: "comiket-2026-winter",
    name: "Comiket (C109) Winter 2026",
    shortName: "C109",
    type: "festival",
    location: "Tokyo Big Sight, Tokyo, Japan",
    country: "Japan",
    startDate: new Date("2026-12-29"),
    endDate: new Date("2026-12-31"),
    website: "https://www.comiket.co.jp",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg",
    description:
      "The world's largest doujinshi convention, returning to Tokyo Big Sight for a three-day winter edition.",
    attendance: null,
    tags: ["doujinshi", "manga", "indie", "merchandise"],
  },
  {
    slug: "anime-india-delhi-2026",
    name: "Anime India Delhi 2026",
    shortName: "Anime India Delhi",
    type: "convention",
    location: "Yashobhoomi Convention Centre, New Delhi, India",
    country: "India",
    startDate: new Date("2026-06-06"),
    endDate: new Date("2026-06-07"),
    website: "https://animeindia.live",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg",
    description:
      "India's anime convention at Yashobhoomi in Dwarka, New Delhi, with cosplay, gaming, music, and guest programming.",
    attendance: null,
    tags: ["india", "delhi", "anime", "cosplay", "j-music"],
  },
  {
    slug: "annec-2026",
    name: "Annecy International Animation Film Festival 2026",
    shortName: "Annecy 2026",
    type: "festival",
    location: "Bonlieu, Annecy, France",
    country: "France",
    startDate: new Date("2026-06-21"),
    endDate: new Date("2026-06-27"),
    website: "https://www.annecy.org",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
    description:
      "A leading international animation festival with film screenings, the MIFA market, and programming from Japanese studios.",
    attendance: null,
    tags: ["animation", "film", "festival", "international", "premiere"],
  },
  {
    slug: "anime-fest-2026",
    name: "Anime Festival Asia 2026",
    shortName: "AFA 2026",
    type: "festival",
    location: "Suntec Singapore Convention & Exhibition Centre, Singapore",
    country: "Singapore",
    startDate: new Date("2026-11-27"),
    endDate: new Date("2026-11-29"),
    website: "https://www.animefestival.asia",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-60q1B6GK2Ghb.jpg",
    description:
      "Southeast Asia's largest anime event, with I Love Anisong concerts, cosplay competition, industry booths, and regional premieres.",
    attendance: null,
    tags: ["asia", "concert", "cosplay", "southeast-asia", "anisong"],
  },
  {
    slug: "anime-nyc-2026",
    name: "Anime NYC 2026",
    shortName: "Anime NYC",
    type: "convention",
    location: "Javits Convention Center, New York, NY",
    country: "USA",
    startDate: new Date("2026-08-20"),
    endDate: new Date("2026-08-23"),
    website: "https://animenyc.com",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137822-U8naszP96vzC.png",
    description:
      "The East Coast's large anime convention at the Javits Center, with premieres, creator appearances, exhibits, and immersive programming.",
    attendance: null,
    tags: ["new-york", "east-coast", "anime", "industry", "premiere"],
  },
];

const REMOVED_SLUGS = [
  "crunchyroll-expo-2026",
  "tokyo-anime-fair-2027",
  "anime-india-expo-2026",
];

async function seedAnimeEvents() {
  const removed = await prisma.animeEvent.deleteMany({
    where: { slug: { in: REMOVED_SLUGS } },
  });
  if (removed.count > 0) {
    console.log(`  Removed ${removed.count} outdated/fake event(s)`);
  }

  for (const event of ANIME_EVENTS_SEED) {
    const upserted = await prisma.animeEvent.upsert({
      where: { slug: event.slug },
      update: event,
      create: event,
    });

    const cleared = await prisma.animeAnnouncement.deleteMany({
      where: { eventId: upserted.id },
    });
    if (cleared.count > 0) {
      console.log(`  Removed ${cleared.count} unsourced announcement(s)`);
    }

    console.log(`  Synced event: ${event.name}`);
  }
}

seedAnimeEvents()
  .then(() => {
    console.log(`Seeded ${ANIME_EVENTS_SEED.length} anime events`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
