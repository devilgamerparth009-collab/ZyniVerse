import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { isDefaultAvatar } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Dedicated credential login for the native APK.
 *
 * Auth.js' browser callback needs a CSRF cookie + callback-url round trip that
 * React Native's fetch() does not keep reliably. Here the app sends the same
 * credentials it already collected, the server verifies the hash against the
 * database, and returns an Auth.js-compatible encrypted session cookie. The
 * cookie is also set on the response so the Android WebView can reuse it.
 */
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, same as Auth.js default

function errorMessage(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: NextRequest) {
  // This endpoint is only for the official app. The proxy also enforces the
  // client header, but checking again keeps direct abuse out of the route.
  if (request.headers.get("x-zyniverse-client") !== "zyniverse-mobile-v1") {
    return errorMessage("Unsupported client", 403);
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorMessage("Invalid request", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || password.length > 200) {
    return errorMessage("Enter a valid email and password.", 400);
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        avatar: true,
        onboarded: true,
        createdAt: true,
      },
    });

    // Run a dummy comparison when the account does not exist so the response
    // time does not reveal which emails are registered.
    const hashed = user?.password || "$2a$12$C6UzMDM.H6dfI/f/IKcEe.6YpNB2/OqDJT2K4RNgBjPDPBWZQJ7Gi";
    const valid = await bcrypt.compare(password, hashed);
    if (!user || !user.password || !valid) {
      return errorMessage("Invalid email or password.", 401);
    }

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return errorMessage("Sign-in is not configured on the server.", 503);
    }

    const url = new URL(request.url);
    const secure = url.protocol === "https:";
    const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

    // Match the payload that Auth.js' credentials callback would create so the
    // regular `auth()`/`getCurrentUser()` path can decrypt it unchanged.
    const token = await encode({
      secret,
      salt: cookieName,
      maxAge: SESSION_MAX_AGE,
      token: {
        name: user.username || user.email.split("@")[0],
        email: user.email,
        // `lib/auth.ts` reads `token.avatar` in its session callback, so the
        // minted JWT must use the same field name as a browser credentials login.
        avatar: isDefaultAvatar(user.avatar) ? null : user.avatar,
        picture: isDefaultAvatar(user.avatar) ? null : user.avatar,
        sub: user.id,
        dbId: user.id,
        provider: "credentials",
        onboarded: user.onboarded ?? false,
        createdAt: user.createdAt,
        profileAt: Date.now(),
      },
    });

    const sessionUser = {
      id: user.id,
      username: user.username || user.email.split("@")[0],
      email: user.email,
      avatar: user.avatar || undefined,
    };

    const response = NextResponse.json(
      {
        ok: true,
        user: sessionUser,
        cookie: `${cookieName}=${token}`,
        expires: expires.toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      expires,
    });
    return response;
  } catch (error) {
    console.error("mobile login failed", error);
    return errorMessage("Could not sign you in right now. Please try again.", 500);
  }
}
