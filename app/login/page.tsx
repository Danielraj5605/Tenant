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
            <span key={i} className="size-10 rounded-full bg-accent lg:size-12 lg:bg-white" />
          ) : (
            <span
              key={i}
              className="size-10 rounded-full border-2 border-dashed border-line-strong lg:size-12 lg:border-white/70"
            />
          ),
        )}
      </div>
      <figcaption className="text-sm font-semibold text-muted lg:text-base lg:text-white/85">
        5 of 6 home today. Chores, meals and splits follow.
      </figcaption>
    </figure>
  );
}

const POINTS = [
  "Chores skip whoever is away.",
  "Meal headcounts update themselves.",
  "Bills split by who was actually home.",
];

/**
 * Phone: the household row and name above the form. Desktop: a teal brand
 * panel on the left and the form centred on the right.
 */
export default function LoginPage() {
  return (
    <main
      data-shell
      className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-between gap-10 px-6 pt-16 pb-[max(2rem,env(safe-area-inset-bottom))] lg:grid lg:min-h-dvh lg:max-w-none lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-0 lg:p-0"
    >
      <section className="flex flex-col gap-8 lg:justify-between lg:bg-accent lg:p-14 lg:text-white xl:p-20">
        <p className="hidden items-center gap-2.5 lg:flex" aria-hidden="true">
          <span className="flex gap-1">
            <span className="size-2.5 rounded-full bg-white" />
            <span className="size-2.5 rounded-full bg-white" />
            <span className="size-2.5 rounded-full border-[1.5px] border-dashed border-white/80" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">Tenant</span>
        </p>
        <div className="flex flex-col gap-8">
          <HouseholdRow />
          <div className="flex flex-col gap-3">
            <h1 className="text-display font-extrabold lg:text-[3.5rem] lg:leading-[1.02] lg:tracking-[-0.03em]">
              Tenant
            </h1>
            <p className="max-w-[30ch] text-lg leading-snug font-medium text-muted lg:text-2xl lg:text-white/90">
              Who&rsquo;s home decides the chores, the meals and the split.
            </p>
          </div>
        </div>
        <ul className="hidden flex-col gap-3 text-base font-semibold text-white/90 lg:flex">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="size-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="lg:flex lg:items-center lg:justify-center lg:p-14">
        <div className="w-full lg:max-w-[400px]">
          <h2 className="mb-6 hidden text-title font-bold lg:block">Sign in or create an account</h2>
          <Suspense fallback={<div className="h-[340px]" aria-hidden="true" />}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
