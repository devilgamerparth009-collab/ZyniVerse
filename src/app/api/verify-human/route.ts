import { NextRequest, NextResponse } from "next/server";
import {
  HUMAN_COOKIE, HUMAN_COOKIE_MAX_AGE, HUMAN_CHALLENGE_COOKIE, HUMAN_CHALLENGE_MAX_AGE,
  createHumanToken, createChallenge, verifyChallenge, expectedChallengeAnswer,
} from "@/lib/human-verification";

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function GET() {
  const { token, nonce } = await createChallenge();
  const res = NextResponse.json({ ok: true, nonce });
  res.cookies.set({
    name: HUMAN_CHALLENGE_COOKIE, value: token, httpOnly: true,
    secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: HUMAN_CHALLENGE_MAX_AGE,
  });
  return res;
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const challenge = req.cookies.get(HUMAN_CHALLENGE_COOKIE)?.value;
  const nonce = await verifyChallenge(challenge);
  if (!nonce) return NextResponse.json({ error: "Challenge expired" }, { status: 400 });

  let body: any = null;
  try { body = await req.json(); } catch {}
  const answer = typeof body?.answer === "string" ? body.answer : "";
  const expected = await expectedChallengeAnswer(nonce);
  if (!answer || answer !== expected) return NextResponse.json({ error: "Invalid verification" }, { status: 400 });

  const token = await createHumanToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: HUMAN_COOKIE, value: token, httpOnly: true,
    secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: HUMAN_COOKIE_MAX_AGE,
  });
  res.cookies.set({
    name: HUMAN_CHALLENGE_COOKIE, value: "", httpOnly: true,
    secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0,
  });
  return res;
}
