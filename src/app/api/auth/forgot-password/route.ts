import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { logError } from "@/lib/logger";
import { authLimiter } from "@/lib/rate-limiter";
import { verifyBotProtection } from "@/lib/bot-protection";
import { hashResetCode } from "@/lib/password-reset";
import crypto from "crypto";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;
const GENERIC = "If an account exists, an email was sent.";

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const botCheck = await verifyBotProtection({ headers: req.headers, ...body });
    if (!botCheck.ok) {
      return NextResponse.json(
        { error: botCheck.reason },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) {
      return NextResponse.json(
        { success: true, message: GENERIC },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    await prisma.passwordResetToken.deleteMany({ where: { email } });

    const code = crypto.randomInt(100000, 1000000).toString();
    await prisma.passwordResetToken.create({
      data: {
        email,
        token: hashResetCode(email, code),
        attempts: 0,
        expires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    if (!resend) {
      await prisma.passwordResetToken.deleteMany({ where: { email } });
      logError(new Error("RESEND_API_KEY is not set — password reset email cannot be sent."));
      return NextResponse.json(
        { error: "Password reset is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    await resend.emails.send({
      from: "ZyniVerse <noreply@zyverse.in>",
      to: email,
      subject: "ZyniVerse - Password Reset Request",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #fff; padding: 20px; border-radius: 12px; border: 1px solid #333;">
          <h2 style="color: #00ffe0; text-align: center;">ZyniVerse Password Reset</h2>
          <p>You requested a password reset. Here is your 6-digit verification code:</p>
          <div style="background: #111; padding: 16px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 8px; margin: 24px 0; color: #ff00e6;">
            ${code}
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p style="color: #888; font-size: 12px; margin-top: 32px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json(
      { success: true, message: GENERIC },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    logError(error, "auth.forgot-password");
    return NextResponse.json({ error: "If an account exists, an email was sent." }, { status: 500 });
  }
}
