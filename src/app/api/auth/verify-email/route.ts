import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authLimiter } from "@/lib/rate-limiter";
import { logError } from "@/lib/logger";

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  try {
    const { email, token } = await req.json();
    if (typeof email !== "string" || typeof token !== "string" || !email || !token) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record || record.email !== normalizedEmail) {
      return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
    }
    if (record.expires < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { id: record.id } }).catch(() => {});
      return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
    }

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: new Date() },
    });
    await prisma.emailVerificationToken.deleteMany({ where: { email: normalizedEmail } });

    return NextResponse.json({ ok: true, message: "Email verified successfully" });
  } catch (error) {
    logError(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
