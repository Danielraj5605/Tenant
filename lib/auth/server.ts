import "server-only";

import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/supabase/env";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "./session";

/** The signed-in user's id from the session cookie, or null. */
export async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, sessionSecret());
  return session?.uid ?? null;
}

export async function startSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const token = await signSession({ uid: userId, exp }, sessionSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://"),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
