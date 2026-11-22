import type { Session } from "next-auth";
import { authorize, requireAdmin as requireAdminRole } from "@/lib/authorize";
import { isAdminRole } from "@/lib/admin-identity";

export { isAdminRole } from "@/lib/admin-identity";
export { authorize } from "@/lib/authorize";

export async function getAdminSession() {
  // The layout only needs a boolean for rendering, but the check still hits the
  // database so a demoted admin loses access on the very next request.
  const authorized = await authorize({
    roles: ["ADMIN"],
    audit: "admin_layout",
  });
  return {
    session: authorized?.user ?? null,
    isAdmin: Boolean(authorized),
    mfaEnabled: authorized?.dbUser.mfaEnabled ?? false,
  };
}

export interface AdminSession extends Session {
  user: Session["user"] & {
    id: string;
    email: string;
  };
}

/**
 * Returns the authorized session (narrowed to a non-optional id/email) when the
 * caller is an admin with MFA enabled, otherwise null.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const authorized = await requireAdminRole();
  if (!authorized) return null;
  return authorized as AdminSession;
}

/** UI-only role hint. Server routes must call `authorize()` instead. */
export function canShowAdminUi(role: unknown): boolean {
  return isAdminRole(role);
}
