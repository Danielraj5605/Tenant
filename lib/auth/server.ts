import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { sessionSecret } from "@/lib/supabase/env";
import { SESSION_COOKIE, newSessionPayload, sessionCookieOptions, signSession, verifySession } from "./session";

/** The signed-in user's id from the session cookie, or null. */
export async function currentUserId(): Promise<string | null> {
  // Verifying the session reads the clock (token expiry), so never prerender past this point.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, sessionSecret());
  return session?.uid ?? null;
}

export async function startSession(userId: string) {
  const token = await signSession(newSessionPayload(userId), sessionSecret());
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
