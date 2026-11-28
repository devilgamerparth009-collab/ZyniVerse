export const AMAZON_TAG = "parthgupta08-21";
export const AMAZON_BASE = "https://www.amazon.in";

export const PLAYASIA_AFFILIATE_ID = "6974637";
export const PLAYASIA_BASE = "https://www.play-asia.com";

export function amazonProductUrl(asin: string): string {
  return `${AMAZON_BASE}/dp/${asin}?tag=${AMAZON_TAG}`;
}

export function amazonSearchUrl(query: string): string {
  return `${AMAZON_BASE}/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}

/** Play-Asia links always carry the user's affiliate_id. */
export function playasiaUrl(query?: string): string {
  const path = query?.trim()
    ? `${PLAYASIA_BASE}/search/2${encodeURIComponent(query.trim())}`
    : `${PLAYASIA_BASE}/`;
  const url = new URL(path);
  url.searchParams.set("affiliate_id", PLAYASIA_AFFILIATE_ID);
  return url.toString();
}
