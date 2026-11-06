import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getFlatContext } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { CreateFlatForm, JoinRequestForm, PendingRequest } from "./forms";

export const metadata = { title: "Set up your flat · Tenant" };

async function Onboarding() {
  const ctx = await getFlatContext();
  if (ctx.me && ctx.flat) redirect("/today");
  const suggestedName = ctx.user.display_name;

  // The latest join request, so a waiting or declined person sees where they stand.
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("join_requests")
    .select("name, status, decided_at, flat:flats(name)")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const flatName = (request?.flat as { name: string } | null)?.name ?? "the flat";
  const declined = request?.status === "declined";

  return (
    <div className="flex flex-col gap-10">
      <CreateFlatForm suggestedName={suggestedName} />
      <section aria-labelledby="join-heading" className="flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex flex-col gap-1">
          <h2 id="join-heading" className="text-title font-bold">
            Joining a flatmate&rsquo;s flat?
          </h2>
          <p className="text-muted">Ask them for the flat code. The admin lets you in.</p>
        </div>
        {request?.status === "pending" ? (
          <PendingRequest flatName={flatName} name={request.name} />
        ) : (
          <>
            {declined ? <Notice tone="warn">The admin of {flatName} declined your request.</Notice> : null}
            <JoinRequestForm suggestedName={suggestedName} />
          </>
        )}
      </section>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col gap-8 px-6 pt-12 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-extrabold">Set up your flat</h1>
        <p className="text-lg font-medium text-muted">
          You&rsquo;ll be the admin. Then share the flat code with your flatmates.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading&hellip;</p>}>
        <Onboarding />
      </Suspense>
    </main>
  );
}
