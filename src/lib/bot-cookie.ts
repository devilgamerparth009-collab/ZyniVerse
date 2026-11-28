/**
 * Bot guard shared between the Proxy (server) and ad components (client).
 *
 * The Proxy classifies the User-Agent on every matched request and drops a
 * short-lived `zyni_bot=1` cookie on *bot responses only*. Ad components read
 * that cookie and never render an ad for flagged traffic, so bot page views
 * cannot turn into invalid impressions / clicks that put the Adsterra account
 * at risk.
 *
 * Real visitors never receive this cookie (and any stale one is cleared), so
 * their responses stay cacheable and ad rendering is unchanged.
 */
import { detectBot } from "@/lib/bot-detect";

export const BOT_COOKIE = "zyni_bot";

/** How long a bot flag survives - kept short so a UA change is picked up. */
export const BOT_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/** True when the current browser is flagged as a bot by the Proxy or UA. */
export function hasBotCookie(): boolean {
  if (typeof document === "undefined") return false;
  const uaBot =
    typeof navigator !== "undefined" && detectBot(navigator.userAgent) !== null;

  const hasCookie = document.cookie
    .split(";")
    .some((part) => part.trim() === `${BOT_COOKIE}=1`);

  if (hasCookie && !uaBot) {
    // The Proxy matcher intentionally skips many ad-bearing pages (home,
    // recommendations, dubs...) to save function invocations. A flag set on a
    // matched catalog route can therefore survive 24h after the visitor's UA
    // is back to a normal browser. Clear it locally so ads are not hidden.
    document.cookie = `${BOT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    return false;
  }
  if (hasCookie) return true;

  // Fallback when proxy matcher doesn't run on this page (saves function invocations).
  return uaBot;
}
