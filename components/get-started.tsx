import Link from "next/link";
import { Card, cx } from "./ui";
import { CheckIcon, ChevronRightIcon } from "./icons";

export type SetupStep = { key: string; label: string; hint: string; href: string; done: boolean };

/**
 * First-run checklist for the admin of a new flat. Each step ticks itself off
 * from real data; the card disappears once everything is done.
 */
export function GetStarted({ steps }: { steps: SetupStep[] }) {
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title font-bold">Get started</h2>
        <p className="text-sm font-bold text-accent-dark">
          {steps.length - left} of {steps.length} done
        </p>
      </div>
      <ol className="flex flex-col">
        {steps.map((s) => (
          <li key={s.key} className="border-b border-line last:border-b-0">
            <Link
              href={s.href}
              className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg"
              aria-label={`${s.label}${s.done ? " (done)" : ""}`}
            >
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                  s.done ? "border-accent bg-accent text-white" : "border-line-strong",
                )}
              >
                {s.done ? <CheckIcon size={16} /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cx("font-semibold", s.done && "text-muted line-through")}>{s.label}</span>
                {s.done ? null : <span className="text-sm text-muted">{s.hint}</span>}
              </span>
              {s.done ? null : <ChevronRightIcon size={20} className="shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
