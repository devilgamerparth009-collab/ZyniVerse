import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Short-lived hand-off token for the mobile WebView session bridge.
 *
 * The mobile app signs in with `fetch()`, so its NextAuth cookie lives in the
 * app, not in the WebView's cookie jar. Passing the raw cookie to the WebView
 * would either put it in a URL (logs, history) or in a request header that
 * Android repeats on every subresource — including third-party image CDNs.
 *
 * Instead the app asks `/api/auth/mobile-web-token` (authenticated) for an
 * opaque token. It expires after two minutes, is bound to the AUTH_SECRET and
 * only ever travels to zyverse.in, where `/auth/mobile-web` turns it back into
 * the real cookie on the response.
 */

const TTL_MS = 2 * 60 * 1000;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`${secret}:mobile-web-bridge`).digest();
}

export function createWebBridgeToken(cookie: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = JSON.stringify({ c: cookie, e: Date.now() + TTL_MS });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

/** Returns the cookie string for a valid token, or null when expired/forged. */
export function readWebBridgeToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const encrypted = raw.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

    const parsed = JSON.parse(json) as { c?: unknown; e?: unknown };
    if (typeof parsed.c !== "string" || typeof parsed.e !== "number") return null;
    if (Date.now() > parsed.e) return null;
    return parsed.c;
  } catch {
    return null;
  }
}
