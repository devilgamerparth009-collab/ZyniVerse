import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authLimiter } from "@/lib/rate-limiter";
import { generateTotpSecret, otpauthUrl } from "@/lib/totp";

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, mfaEnabled: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.mfaEnabled) return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: session.user.id }, data: { mfaSecret: secret, mfaEnabled: false } });
  return NextResponse.json({ ok: true, secret, otpauthUrl: otpauthUrl(secret, user.email) });
}
