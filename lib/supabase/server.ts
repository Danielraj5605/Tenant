import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { Database } from "./types";
import { supabaseEnv } from "./env";

/**
 * Server-side database client using the secret (service role) key. It bypasses
 * row-level security, so every query must be scoped to the signed-in member's
 * flat; permission checks live in the server actions and pages.
 */
export async function createClient() {
  // Never prerender past a database read.
  await connection();
  const { url, secretKey } = supabaseEnv();
  return createSupabaseClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
