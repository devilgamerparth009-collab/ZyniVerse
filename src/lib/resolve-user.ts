import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { verifyBearerToken } from "./session-token";

/**
 * Resolve the caller of a mobile/web API route.
 *
 * Native APK requests send the Auth.js JWT as a Bearer token. The token is not
 * trusted only because it decrypts: `verifyBearerToken` compares its
 * tokenVersion with the database so logout/password reset revokes it instantly.
 */
export async function resolveUserId(): Promise<string | null> {
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) {
    const identity = await verifyBearerToken(bearer);
    return identity?.id ?? null;
  }

  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  if (!userId) {
    if (!session.user.email) return null;
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    return byEmail?.id ?? null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tokenVersion: true },
  });
  if (!user) return null;

  const claimVersion = session.user.tokenVersion ?? 0;
  if (claimVersion !== user.tokenVersion) return null;

  return user.id;
}
