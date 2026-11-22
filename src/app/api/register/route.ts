import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authLimiter } from "@/lib/rate-limiter";
import { logError } from "@/lib/logger";
import { verifyBotProtection } from "@/lib/bot-protection";
import crypto from "crypto";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { action, email, username, password, ref } = body as {
      action?: unknown;
      email?: unknown;
      username?: unknown;
      password?: unknown;
      ref?: unknown;
    };

    const botCheck = await verifyBotProtection({ headers: req.headers, ...body });
    if (!botCheck.ok) {
      return NextResponse.json({ error: botCheck.reason }, { status: 400 });
    }

    if (action === "register") {
      if (!email || !username || !password) {
        return NextResponse.json({ error: "All fields required" }, { status: 400 });
      }
      if (typeof email !== "string" || typeof username !== "string" || typeof password !== "string") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedUsername = username.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
        return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
        return NextResponse.json({ error: "Username must be 3-30 characters: letters, numbers, underscores" }, { status: 400 });
      }
      if (password.length < 8 || password.length > 200) {
        return NextResponse.json({ error: "Password must be 8-200 characters" }, { status: 400 });
      }
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
      });
      if (existing) {
        return NextResponse.json({ error: "Email or username already taken" }, { status: 409 });
      }
      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.hash(password, 12);
      const code = normalizedUsername.toLowerCase() + crypto.randomBytes(3).toString("hex");
      let referredBy: string | null = null;
      if (typeof ref === "string" && ref.trim()) {
        const referrer = await prisma.user.findUnique({ where: { referralCode: ref.trim() } });
        if (referrer?.id) referredBy = referrer.id;
      }
      const user = await prisma.user.create({
        data: { email: normalizedEmail, username: normalizedUsername, password: hashed, referralCode: code, referredBy },
      });
      if (referredBy) {
        await prisma.user.update({ where: { id: referredBy }, data: { referralCount: { increment: 1 } } });
        const rp = await prisma.userPoints.findUnique({ where: { userId: referredBy } });
        if (rp) {
          await prisma.userPoints.update({ where: { userId: referredBy }, data: { points: { increment: 100 } } });
        } else {
          await prisma.userPoints.create({ data: { userId: referredBy, points: 100, level: 1 } });
        }
        await prisma.notification.create({
          data: { userId: referredBy, type: "SYSTEM", title: "New Referral!", body: `${normalizedUsername} joined using your link. You earned 100 XP!`, link: "/earn" },
        });
      }
      await prisma.userPoints.create({ data: { userId: user.id, points: referredBy ? 50 : 0, level: 1 } });

      await prisma.emailVerificationToken.deleteMany({ where: { email: normalizedEmail } });
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await prisma.emailVerificationToken.create({
        data: {
          email: normalizedEmail,
          token: verifyToken,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://zyverse.in";
      const verifyUrl = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;
      if (resend) {
        await resend.emails.send({
          from: "ZyniVerse <noreply@zyverse.in>",
          to: normalizedEmail,
          subject: "Verify your ZyniVerse email",
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#fff;padding:20px;border-radius:12px;border:1px solid #333;">
            <h2 style="color:#00ffe0;text-align:center;">Verify your email</h2>
            <p>Welcome to ZyniVerse! Please verify your email to activate your account.</p>
            <p style="text-align:center;margin:24px 0;"><a href="${verifyUrl}" style="background:#00ffe0;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Verify Email</a></p>
            <p style="color:#888;font-size:12px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
          </div>`,
        });
      } else {
        logError(new Error("RESEND_API_KEY is not set — verification email cannot be sent."));
      }

      return NextResponse.json({ ok: true, requiresVerification: true, id: user.id, email: user.email, username: user.username });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    // Never leak internal error details (Prisma messages, DB paths) to the client.
    logError(e);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
