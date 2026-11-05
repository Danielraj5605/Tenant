import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/auth/server";
import type { AppUser, Flat, Member } from "@/lib/supabase/types";

export type FlatContext = {
  userId: string;
  user: Pick<AppUser, "id" | "username" | "display_name">;
  me: Member | null;
  flat: Flat | null;
};

/** The signed-in user, their member row and their flat (if they have one). */
export const getFlatContext = cache(async (): Promise<FlatContext> => {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("app_users")
    .select("id, username, display_name")
    .eq("id", userId)
    .maybeSingle();
  // Account deleted while a cookie was still around.
  if (!user) redirect("/login?error=signed-out");

  const { data: me } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .is("left_on", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let flat: Flat | null = null;
  if (me) {
    const { data } = await supabase.from("flats").select("*").eq("id", me.flat_id).single();
    flat = data;
  }

  return { userId, user, me, flat };
});

/** For screens inside the app: requires a flat, otherwise goes to onboarding. */
export async function requireFlat() {
  const ctx = await getFlatContext();
  if (!ctx.me || !ctx.flat) redirect("/onboarding");
  return { ...ctx, me: ctx.me, flat: ctx.flat };
}
