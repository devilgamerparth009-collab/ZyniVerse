import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/resolve-user";
import { apiLimiter } from "@/lib/rate-limiter";
import { castPollVote, getPollVoteState } from "@/lib/character-tournaments";

const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

function readDeviceId(req: NextRequest): string | null {
  const raw = req.headers.get("x-device-id");
  if (!raw || !DEVICE_ID_RE.test(raw)) return null;
  return raw;
}

async function readUserId(req: NextRequest): Promise<string | null> {
  const hasBearer = /^Bearer\s+/i.test(req.headers.get("authorization") || "");
  const hasSessionCookie = /(?:^|;\s*)(?:__Secure-)?(?:authjs|next-auth)\.session-token=/.test(
    req.headers.get("cookie") || ""
  );
  return hasBearer || hasSessionCookie ? resolveUserId() : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const { id } = await params;
  const userId = await readUserId(req);
  const deviceId = readDeviceId(req);
  if (!userId && !deviceId) {
    return NextResponse.json({ error: "Vote requires a device" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const participantId = typeof body?.participantId === "string" ? body.participantId : "";
  if (!participantId) return NextResponse.json({ error: "participantId is required" }, { status: 400 });

  try {
    const participant = await castPollVote(id, { userId, deviceId }, participantId);
    return NextResponse.json({
      ok: true,
      participant: { id: participant.id, pollVotes: participant.pollVotes },
      myPollVote: participantId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to vote" },
      { status: 400 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateCheck = await apiLimiter.middleware(req);
  if (rateCheck) return rateCheck;

  const { id } = await params;
  const userId = await readUserId(req);
  const deviceId = readDeviceId(req);

  try {
    const myPollVote = await getPollVoteState(id, { userId, deviceId });
    return NextResponse.json({ myPollVote });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load vote state" },
      { status: 500 }
    );
  }
}