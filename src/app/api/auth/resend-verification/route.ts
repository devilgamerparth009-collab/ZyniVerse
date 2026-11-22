import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authLimiter } from "@/lib/rate-limiter";
import { logError } from "@/lib/logger";
import { verifyBotProtection } from "@/lib/bot-protection";
import crypto from "crypto";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const botCheck = await verifyBotProtection({ headers: req.headers, ...body });
    if (!botCheck.ok) {
      return NextResponse.json({ error: botCheck.reason }, { status: 400 });
    }
    const email = body.email;
    if (typeof email !== "string" || !email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, emailVerified: true } });
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true, message: "If an account needs verification, an email was sent." });
    }

    await prisma.emailVerificationToken.deleteMany({ where: { email: normalizedEmail } });
    const verifyToken = crypto.randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: { email: normalizedEmail, token: verifyToken, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
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
          <p>Please verify your email to activate your account.</p>
          <p style="text-align:center;margin:24px 0;"><a href="${verifyUrl}" style="background:#00ffe0;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Verify Email</a></p>
          <p style="color:#888;font-size:12px;">This link expires in 24 hours.</p>
        </div>`,
      });
    }
    return NextResponse.json({ ok: true, message: "If an account needs verification, an email was sent." });
  } catch (error) {
    logError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
