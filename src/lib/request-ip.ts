/**
 * Client IP resolution that fails closed in production.
 *
 * `x-forwarded-for` is attacker-controlled unless the platform overwrites it.
 * Vercel sets `x-vercel-forwarded-for`; Cloudflare sets `cf-connecting-ip`.
 * Only those are trusted by default. Direct-to-origin requests are grouped as
 * "unknown" instead of letting a caller rotate rate-limit buckets at will.
 */
function first(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.split(",")[0]?.trim();
  return candidate || null;
}

export function getClientIpFromHeaders(headers: Headers): string {
  const vercel = first(headers.get("x-vercel-forwarded-for"));
  if (vercel) return vercel;

  if (process.env.TRUST_CF_CONNECTING_IP === "1") {
    const cloudflare = first(headers.get("cf-connecting-ip"));
    if (cloudflare) return cloudflare;
  }

  // Local/test environments need the conventional headers for their existing
  // tests and dev workflows. Production never trusts them unless explicitly
  // opted in behind a known reverse proxy.
  const trustForwarded =
    process.env.NODE_ENV !== "production" || process.env.TRUST_X_FORWARDED_FOR === "1";
  if (trustForwarded) {
    const forwarded = first(headers.get("x-forwarded-for"));
    if (forwarded) return forwarded;
    const real = first(headers.get("x-real-ip"));
    if (real) return real;
  }

  return "unknown";
}

export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}
