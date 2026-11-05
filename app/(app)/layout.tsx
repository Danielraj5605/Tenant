import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { requireFlat } from "@/lib/flat";

/** Sends people without a flat to onboarding before any tab renders. */
async function FlatGate({ children }: { children: React.ReactNode }) {
  await requireFlat();
  return <>{children}</>;
}

function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line" />
      <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-28">
        <Suspense fallback={<ScreenSkeleton />}>
          <FlatGate>{children}</FlatGate>
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}
