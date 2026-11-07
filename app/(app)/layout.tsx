import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ScreenSkeleton } from "@/components/skeletons";
import { requireFlat } from "@/lib/flat";

/** Sends people without a flat to onboarding before any tab renders. */
async function FlatGate({ children }: { children: React.ReactNode }) {
  await requireFlat();
  return <>{children}</>;
}

/**
 * Phone: one column. Tablet: a wider column. Desktop: a left rail and a
 * centred column; a page with `data-wide` gets room for two columns.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-shell className="flex flex-1 flex-col lg:pl-60">
      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-28 md:max-w-[560px] md:pt-10 lg:max-w-[640px] lg:px-8 lg:pt-12 lg:pb-16">
        <Suspense fallback={<ScreenSkeleton />}>
          <FlatGate>{children}</FlatGate>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
