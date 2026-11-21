import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

/**
 * Lightweight session check for the native APK. It accepts the Bearer token
 * returned by /api/mobile/auth/login (or the normal Auth.js cookie) and never
 * depends on React Native keeping a browser-style cookie jar.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("x-zyniverse-client") !== "zyniverse-mobile-v1") {
    return NextResponse.json(
      { error: "Unsupported client" },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, avatar: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
        image: user.avatar,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
