/** Placeholder shown instantly while a tab's data loads. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line" />
      <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />
    </div>
  );
}
