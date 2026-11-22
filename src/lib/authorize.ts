import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { hasRole, isAdminRole, type UserRole } from "@/lib/admin-identity";
import { logInfo } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface AuthorizedSession extends Session {
  user: Session["user"] & {
    id: string;
    email: string;
    role: UserRole;
  };
  dbUser: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    tokenVersion: number;
    mfaEnabled: boolean;
  };
}

export interface AuthorizeOptions {
  /**Roles allowed to pass. Empty means any signed-in user.*/
  roles?: readonly UserRole[];
  /**Admins must have TOTP enabled before they can use privileged APIs.*/
  requireAdminMfa?: boolean;
  /**Audit label emitted when access is refused.*/
  audit?: string;
}

/**
 * Single server-side authorization gate.
 *
 * The session's role claim is only used for the UI. Every protected route must
 * call this helper so the role, account existence and tokenVersion are read
 * from the database at request time.
 */
export async function authorize(options: AuthorizeOptions = {}): Promise<AuthorizedSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      tokenVersion: true,
      mfaEnabled: true,
    },
  });
  if (!dbUser) return null;

  // Legacy JWTs have no tokenVersion claim; treat them as version 0 so a
  // password reset (which bumps the DB version) always invalidates them.
  const claimVersion = session.user.tokenVersion ?? 0;
  if (claimVersion !== dbUser.tokenVersion) {
    logInfo("auth.revoked_session", { userId: dbUser.id, reason: "token_version" });
    return null;
  }

  const role = dbUser.role as UserRole;
  if (options.roles?.length && !hasRole(role, options.roles)) {
    logInfo("auth.access_denied", {
      userId: dbUser.id,
      role,
      required: options.roles.join(","),
      audit: options.audit,
    });
    return null;
  }

  if (options.requireAdminMfa && isAdminRole(role) && !dbUser.mfaEnabled) {
    logInfo("auth.mfa_required", { userId: dbUser.id, audit: options.audit });
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: dbUser.id,
      email: dbUser.email,
      role,
    },
    dbUser: { ...dbUser, role },
  } as AuthorizedSession;
}

export async function requireUser(): Promise<AuthorizedSession | null> {
  return authorize();
}

export async function requireModerator(): Promise<AuthorizedSession | null> {
  return authorize({ roles: ["MODERATOR", "ADMIN"], audit: "moderator" });
}

export async function requireAdmin(): Promise<AuthorizedSession | null> {
  return authorize({ roles: ["ADMIN"], requireAdminMfa: true, audit: "admin" });
}
