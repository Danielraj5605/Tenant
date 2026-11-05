import type { ReactNode } from "react";

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-display font-extrabold">{title}</h1>
        {subtitle ? <p className="font-medium text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

/** Placeholder for tabs whose phase hasn't been built yet. */
export function NotYet({ title, body }: { title: string; body: string }) {
  return (
    <>
      <ScreenHeader title={title} />
      <section className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-6">
        <p className="font-semibold">{body}</p>
      </section>
    </>
  );
}
