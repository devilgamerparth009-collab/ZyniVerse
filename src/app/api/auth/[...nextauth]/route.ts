import { handlers } from "@/lib/auth";
import { authLimiter } from "@/lib/rate-limiter";
import type { NextRequest } from "next/server";

export const { GET } = handlers;

export async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const rateCheck = await authLimiter.middleware(req);
  if (rateCheck) return rateCheck;
  return (handlers.POST as any)(req, ctx);
}
