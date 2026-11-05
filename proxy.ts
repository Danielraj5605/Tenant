import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { supabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/engine/onboarding";

/** Paths reachable without signing in. */
const PUBLIC_PATHS = ["/login", "/auth/", "/sw.js", "/manifest.webmanifest", "/icons/"];

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to /login. Authorization itself is enforced by RLS in Postgres.
 */
export async function proxy(request: NextRequest) {
  // Supabase falls back to the Site URL (/?code=…) when a redirect URL isn't
  // allow-listed. Hand that code to the callback instead of dropping it.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callback = new URL("/auth/callback", request.url);
    callback.searchParams.set("code", request.nextUrl.searchParams.get("code")!);
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Must run before anything else so a refreshed token is written back.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));

  if (!signedIn && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (signedIn && pathname === "/login") {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
