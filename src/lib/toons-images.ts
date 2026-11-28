import { TOONS_DATABASE, type CartoonEntry } from "@/lib/toons-data";
import { dedupedFetch } from "@/lib/wiki-cache";
import { proxyImageUrl } from "@/lib/avatar-src";

// Verified Wikimedia page images. Titles are canonical English Wikipedia
// articles; a handful of Indian shows only have a Hindi Wikipedia article.
const WIKI_TITLES: Record<string, string> = {
  "chhota-bheem": "Chhota Bheem",
  "motu-patlu": "Motu Patlu",
  "mighty-little-bheem": "Mighty Little Bheem",
  doraemon: "Doraemon (2005 TV series)",
  "shin-chan": "Crayon Shin-chan",
  pokemon: "Pokémon",
  kochikame: "KochiKame: Tokyo Beat Cops",
  "ninja-hattori": "Ninja Hattori-kun",
  "doraemon-nobita": "Doraemon: Nobita's Chronicle of the Moon Exploration",
  "tom-jerry": "Tom Cat",
  "ben-10": "Ben 10 (2005 TV series)",
  "scooby-doo": "Scooby-Doo, Where Are You!",
  spongebob: "SpongeBob SquarePants",
  "powerpuff-girls": "The Powerpuff Girls (2016 TV series)",
  "dexters-lab": "Dexter's Laboratory",
  "oggy-cockroaches": "Oggy and the Cockroaches",
  "kung-fu-panda": "Kung Fu Panda: Legends of Awesomeness",
  "phineas-ferb": "Phineas and Ferb",
  "gravity-falls": "Gravity Falls",
  "avatar-last-airbender": "Avatar: The Last Airbender",
  "dora-explorer": "Dora the Explorer",
  "johnny-bravo": "Johnny Bravo",
  "the-kids-next-door": "Codename: Kids Next Door",
  "the-smurfs": "The Smurfs (1981 TV series)",
  popeye: "Popeye",
  "lilo-stitch": "Lilo & Stitch",
};

const HI_WIKI_TITLES: Record<string, string> = {
  "honey-bunny": "हनी बनी का झोलमाल",
};

// A few Indian shows have no usable Wikipedia page image. These are verified
// artwork/poster files from AnimationXpress's launch coverage for each title.
const OFFICIAL_IMAGES: Record<string, string> = {
  "vir-the-kartoon-kid": "https://www.animationxpress.com/wp-content/uploads/2020/05/ViR-The-Robot-Boy.jpg",
  "lambu-motu": "https://www.animationxpress.com/wp-content/uploads/2021/04/Lambu-G-Tingu-G-LOGO.png",
  rudra: "https://www.animationxpress.com/wp-content/uploads/2018/06/Rudra-Feature.jpg",
  "kid-krishna": "https://www.animationxpress.com/wp-content/uploads/2014/09/Kid-Krrish-Mystery-in-Mongolia.jpeg",
};

const USER_AGENT = "ZyniVerse/1.0 (cartoon artwork lookup)";

type ThumbMap = Record<string, string>;

async function fetchThumbnails(host: string, titles: string[]): Promise<ThumbMap> {
  const unique = [...new Set(titles)];
  if (!unique.length) return {};
  const url = `https://${host}/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=400&pilicense=any&format=json&formatversion=2&redirects=1&origin=*&titles=${encodeURIComponent(unique.join("|"))}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return {};
  const data = await res.json();
  const map: ThumbMap = {};
  for (const page of data.query?.pages || []) {
    if (page.thumbnail?.source) map[page.title] = page.thumbnail.source;
  }
  // Redirects/normalisations: keep the requested spelling working too.
  for (const redirect of data.query?.redirects || []) {
    if (map[redirect.to] && !map[redirect.from]) map[redirect.from] = map[redirect.to];
  }
  for (const normal of data.query?.normalized || []) {
    if (map[normal.to] && !map[normal.from]) map[normal.from] = map[normal.to];
  }
  return map;
}

async function safeThumbs(key: string, host: string, titles: string[]): Promise<ThumbMap> {
  try {
    return await dedupedFetch(key, () => fetchThumbnails(host, titles));
  } catch {
    // Wikipedia unavailable — keep the original data and let the card's
    // initials artwork show instead of breaking the page.
    return {};
  }
}

export async function getToonsWithImages(): Promise<CartoonEntry[]> {
  const [enThumbs, hiThumbs] = await Promise.all([
    safeThumbs("toons:wiki-images:en", "en.wikipedia.org", Object.values(WIKI_TITLES)),
    safeThumbs("toons:wiki-images:hi", "hi.wikipedia.org", Object.values(HI_WIKI_TITLES)),
  ]);

  return TOONS_DATABASE.map((t) => {
    const enTitle = WIKI_TITLES[t.id];
    const hiTitle = HI_WIKI_TITLES[t.id];
    const raw = (enTitle && enThumbs[enTitle]) || (hiTitle && hiThumbs[hiTitle]) || OFFICIAL_IMAGES[t.id] || t.image;
    const image = proxyImageUrl(raw) ?? "";
    return { ...t, image };
  });
}
