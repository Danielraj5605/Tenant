import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Flat, Member } from "@/lib/supabase/types";

export type FlatContext = {
  userId: string;
  email: string | null;
  metadata: Record<string, unknown>;
  me: Member | null;
  flat: Flat | null;
};

/** The signed-in user, their member row and their flat (if they have one). */
export const getFlatContext = cache(async (): Promise<FlatContext> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: me } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", claims.sub)
    .is("left_on", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let flat: Flat | null = null;
  if (me) {
    const { data } = await supabase.from("flats").select("*").eq("id", me.flat_id).single();
    flat = data;
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
    me,
    flat,
  };
});

/** For screens inside the app: requires a flat, otherwise goes to onboarding. */
export async function requireFlat() {
  const ctx = await getFlatContext();
  if (!ctx.me || !ctx.flat) redirect("/onboarding");
  return { ...ctx, me: ctx.me, flat: ctx.flat };
}
