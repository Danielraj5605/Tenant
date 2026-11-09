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

/** Calendar placeholder: the month grid beside the selected day. */
export function CalendarSkeleton() {
  return (
    <div data-wide className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-9 w-48" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
          <Skeleton className="mx-auto h-6 w-36" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl lg:h-13" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-[52px] w-full rounded-full" />
          </div>
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chores placeholder: header, the two tabs and chore cards. */
export function ChoresSkeleton() {
  return (
    <div data-wide className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="mb-1 flex items-start justify-between gap-4">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>
      <Skeleton className="h-[52px] w-full rounded-full lg:max-w-sm" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-11 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton key={j} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Menu placeholder: header, the week switcher and day cards with three meals. */
export function MenuSkeleton() {
  return (
    <div data-wide className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>
      <Skeleton className="h-[52px] w-full rounded-full lg:max-w-md" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="flex gap-3 py-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Money placeholder: month switcher, the two totals, actions and bill rows. */
export function MoneySkeleton() {
  return (
    <div data-wide className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="mb-1 flex flex-col gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-2/3 max-w-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[52px] w-full rounded-full" />
          <div className="grid h-28 grid-cols-2 gap-4 rounded-[var(--radius-card)] bg-surface p-5">
            <Skeleton className="h-full" />
            <Skeleton className="h-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-[52px] rounded-full" />
            <Skeleton className="h-[52px] rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5">
          <Skeleton className="h-6 w-20" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
