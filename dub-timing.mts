import { fetchText } from "@/lib/dub-import/sources";
import { parseAnimeDubHindiListing } from "@/lib/dub-import/parsers";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await fn();
  console.log(`${label}: ${Date.now() - t0}ms`);
  return out;
}

async function main() {
  const html = await time("listing fetch", () =>
    fetchText("https://www.animedubhindi.link/category/series/page/5/")
  );
  console.log("bytes", html.length);
  const parsed = await time("parse", async () => parseAnimeDubHindiListing(html, "https://www.animedubhindi.link"));
  console.log("items", parsed.items.length, "lastPage", parsed.lastPage);
  console.log(parsed.items.slice(0, 2));
}

main();
