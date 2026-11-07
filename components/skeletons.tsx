import { Skeleton } from "./ui";

/** Generic tab placeholder: a header and two blocks shaped like cards. */
export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="mb-2 flex flex-col gap-2">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/** Today placeholder: greeting, the duty block, who's home and the menu. */
export function TodaySkeleton() {
  return (
    <div data-wide className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-3/4 max-w-80" />
        </div>
        <Skeleton className="size-11 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="flex h-40 flex-col justify-between rounded-[var(--radius-card)] bg-accent/15 p-5">
            <Skeleton className="h-4 w-28 bg-accent/20" />
            <Skeleton className="h-[52px] w-full rounded-full bg-accent/20" />
          </div>
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5">
            <Skeleton className="h-5 w-28" />
            <div className="flex gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="size-12 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3 py-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
