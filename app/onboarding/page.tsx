import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getFlatContext } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { Card, Notice, Skeleton } from "@/components/ui";
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
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5 md:p-7">
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-bold">Start a new flat</h2>
          <p className="text-muted">You&rsquo;ll be the admin. Then share the flat code with your flatmates.</p>
        </div>
        <CreateFlatForm suggestedName={suggestedName} />
      </Card>
      <div className="flex items-center gap-3 px-2 text-sm font-semibold text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line-strong" />
        or
        <span className="h-px flex-1 bg-line-strong" />
      </div>
      <Card className="flex flex-col gap-4 md:p-7">
        <section aria-labelledby="join-heading" className="flex flex-col gap-4">
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
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main
      data-shell
      className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-8 px-5 pt-12 pb-[max(2rem,env(safe-area-inset-bottom))] md:pt-20"
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2.5" aria-hidden="true">
          <span className="flex gap-1">
            <span className="size-2.5 rounded-full bg-accent" />
            <span className="size-2.5 rounded-full bg-accent" />
            <span className="size-2.5 rounded-full border-[1.5px] border-dashed border-muted" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Tenant</span>
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-display font-extrabold md:text-display-lg">Set up your flat</h1>
          <p className="text-lg font-medium text-muted">Start a new flat, or join the one your flatmates use.</p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-72 rounded-[var(--radius-card)]" />
            <Skeleton className="h-48 rounded-[var(--radius-card)]" />
          </div>
        }
      >
        <Onboarding />
      </Suspense>
    </main>
  );
}
