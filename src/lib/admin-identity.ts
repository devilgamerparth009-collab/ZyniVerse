/**
 * Centralized role helpers.
 *
 * Authorization is database-backed (User.role). The values mirrored onto the
 * Auth.js session are only a fast UI hint; server-side checks must resolve the
 * current role from the database through `lib/authorize.ts`.
 */
export const USER_ROLES = ["USER", "MODERATOR", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "USER";
}

export function hasRole(role: unknown, allowed: readonly UserRole[]): boolean {
  return isUserRole(role) && allowed.includes(role);
}

export function isAdminRole(role: unknown): boolean {
  return hasRole(role, ["ADMIN"]);
}

export function isModeratorRole(role: unknown): boolean {
  return hasRole(role, ["MODERATOR", "ADMIN"]);
}
