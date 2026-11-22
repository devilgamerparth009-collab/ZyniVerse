-- Security hardening: DB-backed roles, session revocation, MFA and reset-attempt tracking.
-- All statements are guarded so a partially applied manual rollout cannot break deploy.

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockoutUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Accounts that existed before email verification was introduced are trusted.
UPDATE "User" SET "emailVerified" = COALESCE("emailVerified", "createdAt", CURRENT_TIMESTAMP)
  WHERE "emailVerified" IS NULL;

-- Bootstrap the existing owner into the DB role. All future checks use this
-- column; the old hardcoded email allowlist is removed from application code.
UPDATE "User" SET "role" = 'ADMIN' WHERE LOWER("email") = 'gupta.parth2857@gmail.com';

ALTER TABLE "PasswordResetToken"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_token_key" UNIQUE ("token");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");
