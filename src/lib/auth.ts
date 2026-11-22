import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import { isDefaultAvatar } from "./avatar";
import { logInfo } from "./logger";
import { verifyTotp } from "./totp";
import { normalizeRole } from "./admin-identity";
import { verifyBotProtection } from "./bot-protection";
import { revokeUserSessions } from "./session-token";

const providers = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      totp: { label: "TOTP", type: "text" },
      website: { label: "Website", type: "text" },
      startedAt: { label: "Started At", type: "text" },
      turnstileToken: { label: "Security Token", type: "text" },
    },
    async authorize(credentials) {
      const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
      const password = credentials?.password as string | undefined;
      const totp = typeof credentials?.totp === "string" ? credentials.totp.trim() : "";
      if (!email || !password) return null;

      const botCheck = await verifyBotProtection({
        headers: await headers(),
        website: credentials?.website,
        startedAt:
          typeof credentials?.startedAt === "string"
            ? Number(credentials.startedAt)
            : credentials?.startedAt,
        turnstileToken: credentials?.turnstileToken,
      });
      if (!botCheck.ok) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      const hashed = user?.password || "$2a$12$C6UzMDM.H6dfI/f/IKcEe.6YpNB2/OqDJT2K4RNgBjPDPBWZQJ7Gi";
      const now = new Date();

      if (user?.lockoutUntil && user.lockoutUntil > now) {
        await bcrypt.compare(password, hashed); // timing parity
        return null;
      }

      const match = await bcrypt.compare(password, hashed);
      if (!user || !user.password || !match) {
        if (user && user.password) {
          const failedLoginCount = (user.failedLoginCount ?? 0) + 1;
          const lockoutUntil = failedLoginCount >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: lockoutUntil ? 0 : failedLoginCount,
              lockoutUntil,
            },
          }).catch(() => {});
        }
        return null;
      }

      // Email verification: legacy users (no verification token ever created) are grandfathered.
      if (!user.emailVerified) {
        const pendingVerification = await prisma.emailVerificationToken.findFirst({
          where: { email: user.email },
          select: { id: true },
        });
        if (pendingVerification) {
          return null; // unverified new account
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: user.createdAt ?? now, failedLoginCount: 0, lockoutUntil: null },
        }).catch(() => {});
      } else if (user.failedLoginCount > 0 || user.lockoutUntil) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockoutUntil: null },
        }).catch(() => {});
      }

      if (user.mfaEnabled) {
        if (!totp) return null;
        let ok = user.mfaSecret ? verifyTotp(user.mfaSecret, totp) : false;
        if (!ok) {
          const hash = crypto.createHash("sha256").update(totp).digest("hex");
          const codes = user.mfaRecoveryCodes || [];
          if (codes.includes(hash)) {
            ok = true;
            await prisma.user.update({
              where: { id: user.id },
              data: { mfaRecoveryCodes: codes.filter((c) => c !== hash) },
            }).catch(() => {});
          }
        }
        if (!ok) return null;
      }

      return { id: user.id, email: user.email, name: user.username };
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : []),
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })]
    : []),
  ...(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET
    ? [Discord({ clientId: process.env.AUTH_DISCORD_ID, clientSecret: process.env.AUTH_DISCORD_SECRET })]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers,
  cookies: {
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" || account?.provider === "github" || account?.provider === "discord") {
        const email = profile?.email as string;
        if (!email) return false;
        const picture = (profile?.picture as string) || (profile?.avatar_url as string) || null;
        const cleanPicture = picture && !isDefaultAvatar(picture) ? picture : null;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
          // Generate a unique username
          let baseName = profile?.name || (profile as { login?: string } | undefined)?.login || email.split("@")[0];
          // Sanitize: keep only alphanumeric and underscores, max 20 chars
          baseName = baseName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
          let username = baseName;
          let suffix = 1;
          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseName}${suffix++}`;
          }
          const code = baseName.toLowerCase() + Math.random().toString(36).slice(2, 6);
          await prisma.user.create({
            data: {
              email,
              username,
              password: "",
              provider: account.provider,
              referralCode: code,
              avatar: cleanPicture,
            },
          });
          const newUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
          if (newUser) {
            await prisma.userPoints.upsert({ where: { userId: newUser.id }, update: {}, create: { userId: newUser.id, points: 0, level: 1 } });
          }
        } else if (!existing.avatar && cleanPicture) {
          await prisma.user.update({ where: { id: existing.id }, data: { avatar: cleanPicture } });
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.dbId as string) || "";
        session.user.onboarded = (token.onboarded as boolean) ?? false;
        session.user.createdAt = token.createdAt as Date | undefined;
        session.user.image = (token.avatar as string | null) ?? null;
        session.user.role = normalizeRole(token.role);
        session.user.tokenVersion = typeof token.tokenVersion === "number" ? token.tokenVersion : 0;
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
        session.user.mfaRequired = session.user.role === "ADMIN" && !session.user.mfaEnabled;
      }
      return session;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        // Only establish the database id here. Role/tokenVersion/mfaEnabled are
        // always read fresh below so a revoked or demoted session dies at once.
        if (account?.provider === "credentials") {
          token.dbId = user.id;
        } else if (account?.provider && user.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          token.dbId = dbUser?.id || user.id;
        } else {
          token.dbId = user.id;
        }
      }

      if (!token.dbId && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true },
        });
        if (dbUser) token.dbId = dbUser.id;
      }

      if (token.dbId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.dbId as string },
          select: {
            avatar: true,
            onboarded: true,
            createdAt: true,
            tokenVersion: true,
            role: true,
            mfaEnabled: true,
          },
        });
        if (!dbUser) {
          token.dbId = undefined;
          token.sub = undefined;
          return token;
        }

        // Legacy JWTs without the claim are treated as version 0. After a
        // password reset/logout the DB version differs, so the token is dead.
        const claimVersion = typeof token.tokenVersion === "number" ? token.tokenVersion : 0;
        if (claimVersion !== dbUser.tokenVersion) {
          token.dbId = undefined;
          token.sub = undefined;
          return token;
        }

        token.tokenVersion = dbUser.tokenVersion ?? 0;
        token.role = normalizeRole(dbUser.role);
        token.mfaEnabled = dbUser.mfaEnabled ?? false;

        // Profile display fields are refreshed at most every 5 minutes.
        const PROFILE_TTL_MS = 5 * 60 * 1000;
        const profileStale =
          trigger === "update" ||
          token.profileAt === undefined ||
          Date.now() - (token.profileAt as number) > PROFILE_TTL_MS;
        if (profileStale) {
          token.avatar = dbUser.avatar && !isDefaultAvatar(dbUser.avatar) ? dbUser.avatar : null;
          token.onboarded = dbUser.onboarded ?? false;
          token.createdAt = dbUser.createdAt;
          token.profileAt = Date.now();
        }
      }

      if (account) token.provider = account.provider;
      return token;
    },
  },
  events: {
    async signIn({ user, account }) {
      logInfo("auth.sign_in", { userId: user.id, provider: account?.provider ?? "unknown" });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      const userId = typeof token?.dbId === "string" ? token.dbId : typeof token?.sub === "string" ? token.sub : null;
      if (userId) {
        await revokeUserSessions(userId, "web_logout").catch(() => undefined);
      }
      logInfo("auth.sign_out", { userId: userId ?? "unknown" });
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
});
