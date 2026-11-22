import crypto from "crypto";

const RESET_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

/**
 * Password-reset codes are six digits. Storing them raw means anyone with
 * database read access can reset any account, so only a keyed digest is
 * persisted. The plaintext code is sent in the email and never stored.
 */
export function hashResetCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", RESET_SECRET)
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}
