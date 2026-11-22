import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authLimiter } from "@/lib/rate-limiter";
import { logInfo, logError } from "@/lib/logger";
import { verifyBotProtection } from "@/lib/bot-protection";
import { hashResetCode } from "@/lib/password-reset";
import { revokeUserSessions } from "@/lib/session-token";

const MAX_ATTEMPTS = 5;
const INVALID = "Invalid or expired code.";

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const noStore = { "Cache-Control": "no-store, max-age=0" };

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const botCheck = await verifyBotProtection({ headers: req.headers, ...body });
    if (!botCheck.ok) {
      return NextResponse.json({ error: botCheck.reason }, { status: 400, headers: noStore });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400, headers: noStore });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: INVALID }, { status: 400, headers: noStore });
    }
    if (newPassword.length < 8 || newPassword.length > 200) {
      return NextResponse.json(
        { error: "Password must be 8-200 characters" },
        { status: 400, headers: noStore }
      );
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashResetCode(email, code) },
    });

    if (!resetToken || resetToken.email !== email) {
      return NextResponse.json({ error: INVALID }, { status: 400, headers: noStore });
    }

    if (resetToken.expires <= new Date() || resetToken.attempts >= MAX_ATTEMPTS) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => undefined);
      return NextResponse.json({ error: INVALID }, { status: 400, headers: noStore });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => undefined);
      return NextResponse.json({ error: INVALID }, { status: 400, headers: noStore });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // One version bump invalidates the browser session, every native Bearer
    // token and any other device signed in with the old password.
    await revokeUserSessions(user.id, "password_reset");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockoutUntil: null,
      },
    });

    await prisma.passwordResetToken.deleteMany({ where: { email } });
    logInfo("auth.password_reset", { userId: user.id });

    return NextResponse.json(
      { success: true, message: "Password updated successfully" },
      { headers: noStore }
    );
  } catch (error) {
    logError(error, "auth.reset-password");
    return NextResponse.json({ error: INVALID }, { status: 500, headers: noStore });
  }
}
