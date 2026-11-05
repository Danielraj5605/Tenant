import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/engine/onboarding";

/** Google sign-in and email magic links both return here with `?code=`. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("error", "link");
  if (next !== "/today") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
