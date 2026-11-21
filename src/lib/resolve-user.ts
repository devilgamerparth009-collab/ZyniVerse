import { headers } from "next/headers";
import { decode } from "next-auth/jwt";
import { prisma } from "./prisma";
import { auth } from "./auth";

const SESSION_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

// The APK mints its token with the same salt Auth.js uses for the live cookie.
// Trying both names keeps local (http) and production (https) sessions valid.
const SESSION_SALTS = ["__Secure-authjs.session-token", "authjs.session-token"];

async function userIdFromBearerToken(token: string): Promise<string | null> {
  if (!token || !SESSION_SECRET) return null;

  for (const salt of SESSION_SALTS) {
    try {
      const payload = await decode({ token, secret: SESSION_SECRET, salt });
      const id = (payload?.dbId as string | undefined) || (payload?.sub as string | undefined);
      if (id) {
        const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (exists) return id;
      }
      const email = payload?.email as string | undefined;
      if (email) {
        const byEmail = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (byEmail) return byEmail.id;
      }
    } catch {
      // Try the other cookie name. A malformed/expired token resolves to null.
    }
  }
  return null;
}

export async function resolveUserId(): Promise<string | null> {
  // Native APK requests send their session token as a Bearer token. Android's
  // networking layer does not always preserve a manually set Cookie header, so
  // verifying the token directly is the reliable path for the app.
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    return userIdFromBearerToken(bearer);
  }

  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  if (userId) {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (exists) return userId;
  }

  if (session.user.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return null;
}
