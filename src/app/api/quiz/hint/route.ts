import { NextRequest, NextResponse } from "next/server";
import { apiLimiter } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  const rateLimited = await apiLimiter.middleware(req);
  if (rateLimited) return rateLimited;

  const body = await req.json().catch(() => ({}));
  const questionId = body?.questionId;
  const options = body?.options;
  if (!questionId || !Array.isArray(options) || options.length === 0) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { checkAnswer } = await import("@/lib/quiz");
  const result = await checkAnswer(String(questionId), String(options[0]));

  const wrongOptions = options
    .filter((o: unknown): o is string => typeof o === "string")
    .filter((o: string) => o !== result.correctAnswer);
  const toRemove = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 2);

  return NextResponse.json({ remove: toRemove });
}
