import { getClientIpFromHeaders } from "@/lib/request-ip";
import { logInfo } from "@/lib/logger";

export interface BotCheckInput {
  headers: Headers;
  website?: unknown;
  startedAt?: unknown;
  turnstileToken?: unknown;
}

export interface BotCheckResult {
  ok: boolean;
  reason?: string;
}

const GENERIC_REASON = "Bot check failed. Please try again.";
const MIN_FILL_MS = 1200;

/** Shared bot check for login, registration and password-reset endpoints. */
export async function verifyBotProtection(input: BotCheckInput): Promise<BotCheckResult> {
  // Native app traffic uses its own client gate and rate limits; it does not
  // render web forms, so it cannot submit the web-only bot fields.
  if (input.headers.get("x-zyniverse-client") === "zyniverse-mobile-v1") {
    return { ok: true };
  }

  if (typeof input.website === "string" && input.website.trim()) {
    logInfo("bot.honeypot_blocked", { path: input.headers.get("referer") || "unknown" });
    return { ok: false, reason: GENERIC_REASON };
  }

  if (typeof input.startedAt === "number" && Number.isFinite(input.startedAt)) {
    if (Date.now() - input.startedAt < MIN_FILL_MS) {
      logInfo("bot.too_fast_blocked", { path: input.headers.get("referer") || "unknown" });
      return { ok: false, reason: GENERIC_REASON };
    }
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const token = typeof input.turnstileToken === "string" ? input.turnstileToken.trim() : "";
    if (!token) return { ok: false, reason: "Please complete the security check." };

    try {
      const body = new URLSearchParams({ secret: turnstileSecret, response: token });
      const ip = getClientIpFromHeaders(input.headers);
      if (ip !== "unknown") body.set("remoteip", ip);
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false, reason: GENERIC_REASON };
      const data = (await res.json()) as { success?: boolean };
      if (!data.success) {
        logInfo("bot.turnstile_failed", { ip });
        return { ok: false, reason: "Security check failed. Please try again." };
      }
    } catch {
      return { ok: false, reason: "Security check is unavailable. Please try again." };
    }
  }

  return { ok: true };
}
