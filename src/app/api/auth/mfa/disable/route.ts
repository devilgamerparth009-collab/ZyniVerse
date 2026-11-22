import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authLimiter } from "@/lib/rate-limiter";
import bcrypt from "bcryptjs";
import { verifyTotp } from "@/lib/totp";
import crypto from "crypto";

export async function POST(req: Request) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password, code } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || typeof code !== "string") {
    return NextResponse.json({ error: "Password and MFA code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, mfaEnabled: true, mfaSecret: true, mfaRecoveryCodes: true },
  });
  if (!user?.password) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const okPass = await bcrypt.compare(password, user.password);
  if (!okPass) return NextResponse.json({ error: "Invalid password or code" }, { status: 401 });

  let okCode = false;
  if (user.mfaEnabled && user.mfaSecret) okCode = verifyTotp(user.mfaSecret, code);
  if (!okCode) {
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    okCode = (user.mfaRecoveryCodes || []).includes(hash);
  }
  if (!okCode) return NextResponse.json({ error: "Invalid password or code" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] },
  });
  return NextResponse.json({ ok: true });
}
