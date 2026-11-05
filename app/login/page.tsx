import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Tenant" };

/** Six flatmates, one away: the idea the whole app runs on. */
function HouseholdRow() {
  const home = 5;
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) =>
          i < home ? (
            <span key={i} className="size-10 rounded-full bg-accent" />
          ) : (
            <span key={i} className="size-10 rounded-full border-2 border-dashed border-line-strong" />
          ),
        )}
      </div>
      <figcaption className="text-sm font-semibold text-muted">
        5 of 6 home today. Chores, meals and splits follow.
      </figcaption>
    </figure>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col justify-between gap-10 px-6 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-8">
        <HouseholdRow />
        <div className="flex flex-col gap-3">
          <h1 className="text-display font-extrabold">Tenant</h1>
          <p className="max-w-[30ch] text-lg leading-snug font-medium text-muted">
            Who&rsquo;s home decides the chores, the meals and the split.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="h-[260px]" aria-hidden="true" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
