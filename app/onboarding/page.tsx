import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getFlatContext } from "@/lib/flat";
import { defaultMemberName } from "@/lib/engine/onboarding";
import { CreateFlatForm, OpenInviteForm } from "./forms";

export const metadata = { title: "Set up your flat · Tenant" };

async function Onboarding() {
  const ctx = await getFlatContext();
  if (ctx.me && ctx.flat) redirect("/today");
  const suggestedName = defaultMemberName(ctx.metadata, ctx.email);

  return (
    <div className="flex flex-col gap-10">
      <CreateFlatForm suggestedName={suggestedName} />
      <section aria-labelledby="join-heading" className="flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex flex-col gap-1">
          <h2 id="join-heading" className="text-title font-bold">
            Joining a flatmate&rsquo;s flat?
          </h2>
          <p className="text-muted">Open the invite link they sent you, or paste it here.</p>
        </div>
        <OpenInviteForm />
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
          You&rsquo;ll be the admin. You can invite your flatmates next.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading&hellip;</p>}>
        <Onboarding />
      </Suspense>
    </main>
  );
}
