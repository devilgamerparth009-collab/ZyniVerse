import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { logInfo } from "@/lib/logger";

const SESSION_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

// The APK mints its token with the same Auth.js salts used by the live cookie.
// Trying both keeps local (http) and production (https) sessions valid.
const SESSION_SALTS = ["__Secure-authjs.session-token", "authjs.session-token"];

export interface SessionIdentity {
  id: string;
  email: string;
  tokenVersion: number;
  role: string;
  mfaEnabled: boolean;
}

async function decodeSessionToken(token: string): Promise<Record<string, unknown> | null> {
  if (!token || !SESSION_SECRET) return null;
  for (const salt of SESSION_SALTS) {
    try {
      const payload = await decode({ token, secret: SESSION_SECRET, salt });
      if (payload && typeof payload === "object") return payload as Record<string, unknown>;
    } catch {
      // Wrong salt or malformed/expired token; try the other cookie name.
    }
  }
  return null;
}

function payloadId(payload: Record<string, unknown>): string | null {
  const direct = payload.dbId || payload.sub;
  return typeof direct === "string" && direct ? direct : null;
}

/** Decode a Bearer token without applying revocation checks (logout use only). */
export async function getIdentityFromBearerToken(token: string): Promise<SessionIdentity | null> {
  const payload = await decodeSessionToken(token);
  if (!payload) return null;
  const id = payloadId(payload);
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, tokenVersion: true, role: true, mfaEnabled: true },
  });
  if (!user) return null;
  return { ...user, role: String(user.role) };
}

/**
 * Verify a native-app Bearer token against the database. A password reset,
 * server-side logout, or role change bumps tokenVersion and invalidates every
 * previously minted JWT immediately instead of waiting for expiry.
 */
export async function verifyBearerToken(token: string): Promise<SessionIdentity | null> {
  const payload = await decodeSessionToken(token);
  if (!payload) return null;

  const id = payloadId(payload);
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!id && !email) return null;

  const user = id
    ? await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, tokenVersion: true, role: true, mfaEnabled: true },
      })
    : email
      ? await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, tokenVersion: true, role: true, mfaEnabled: true },
        })
      : null;

  if (!user) return null;

  const claimVersion = typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0;
  if (claimVersion !== user.tokenVersion) {
    logInfo("auth.revoked_bearer", { userId: user.id, reason: "token_version" });
    return null;
  }

  return { ...user, role: String(user.role) };
}

export async function revokeUserSessions(userId: string, reason: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  logInfo("auth.sessions_revoked", { userId, reason });
}
