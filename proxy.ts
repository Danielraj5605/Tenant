import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  newSessionPayload,
  sessionCookieOptions,
  shouldRenew,
  signSession,
  verifySession,
} from "@/lib/auth/session";
import { safeNextPath } from "@/lib/engine/onboarding";

/** Paths reachable without signing in. */
const PUBLIC_PATHS = ["/login", "/sw.js", "/manifest.webmanifest", "/icons/"];

/**
 * Sends signed-out visitors to /login and signed-in ones away from it. This is
 * only the front door: every page and action checks the session again on the
 * server before touching data.
 */
export async function proxy(request: NextRequest) {
  const secret = process.env.SESSION_SECRET ?? "";
  const session = secret.length >= 32 ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));

  if (!session && !isPublic) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  // Sliding session: keep people signed in for as long as they keep using the app.
  if (session && shouldRenew(session)) {
    const token = await signSession(newSessionPayload(session.uid), secret);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
