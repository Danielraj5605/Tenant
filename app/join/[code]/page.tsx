import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFlatContext } from "@/lib/flat";
import { inviteCodeFrom } from "@/lib/engine/onboarding";
import { Card, Notice } from "@/components/ui";
import { JoinForm } from "./join-form";

export const metadata = { title: "Join a flat · Tenant" };

async function Invite({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = inviteCodeFrom(rawCode);
  const ctx = await getFlatContext();

  const supabase = await createClient();
  const { data } = code ? await supabase.rpc("invite_preview", { p_code: code, p_user_id: ctx.userId }) : { data: null };
  const invite = data?.[0];

  if (!code || !invite) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-display font-extrabold">Invite not found</h1>
        <Notice tone="warn">
          This invite link is not valid. It may have been mistyped, or the admin may have shared a newer one.
        </Notice>
        <Link href="/onboarding" className="min-h-11 py-3 font-bold text-accent underline-offset-4 hover:underline">
          Set up a flat instead
        </Link>
      </div>
    );
  }

  if (invite.already_member) redirect("/today");

  const inOtherFlat = Boolean(ctx.me && ctx.flat && ctx.flat.id !== invite.flat_id);
  const count = invite.flatmate_count;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-medium text-muted">You&rsquo;re invited to</p>
        <h1 className="text-display font-extrabold break-words">{invite.flat_name}</h1>
        <p className="text-muted">
          {count} {count === 1 ? "flatmate has" : "flatmates have"} joined so far.
        </p>
      </div>
      {inOtherFlat ? (
        <Card className="flex flex-col gap-3">
          <Notice tone="warn">
            You already belong to {ctx.flat?.name}. Tenant supports one flat per account for now.
          </Notice>
          <Link href="/today" className="min-h-11 py-3 font-bold text-accent underline-offset-4 hover:underline">
            Go to {ctx.flat?.name}
          </Link>
        </Card>
      ) : (
        <JoinForm code={code} suggestedName={ctx.user.display_name} />
      )}
    </div>
  );
}

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="flex flex-1 flex-col px-6 pt-12 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Suspense fallback={<p className="text-muted">Loading invite&hellip;</p>}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}
