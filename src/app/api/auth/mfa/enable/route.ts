import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authLimiter } from "@/lib/rate-limiter";
import { verifyTotp } from "@/lib/totp";
import crypto from "crypto";

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string") return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { mfaSecret: true, mfaEnabled: true } });
  if (!user?.mfaSecret) return NextResponse.json({ error: "MFA setup not started" }, { status: 400 });
  if (user.mfaEnabled) return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
  if (!verifyTotp(user.mfaSecret, code)) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString("hex"));
  const hashedCodes = recoveryCodes.map((c) => crypto.createHash("sha256").update(c).digest("hex"));
  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: true, mfaRecoveryCodes: hashedCodes },
  });
  return NextResponse.json({ ok: true, recoveryCodes });
}
