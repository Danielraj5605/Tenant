import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** `inverse` sits on an accent-filled block (the duty card). */
type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "inverse-ghost";

const buttonBase =
  "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition-colors disabled:cursor-not-allowed";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark disabled:bg-line-strong disabled:text-muted",
  secondary:
    "border border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-bg active:bg-line disabled:text-muted",
  ghost: "text-accent hover:bg-accent-tint active:bg-accent-tint disabled:text-muted",
  inverse:
    "bg-surface text-accent-dark shadow-[0_1px_0_rgb(0_0_0/0.08)] focus-visible:outline-white hover:bg-accent-tint active:bg-accent-tint disabled:bg-white/70 disabled:text-accent-dark/70",
  "inverse-ghost": "text-white focus-visible:outline-white underline-offset-4 hover:bg-white/10 hover:underline active:bg-white/15 disabled:text-white/70",
};

export function Button({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      className={cx(buttonBase, buttonVariants[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-[var(--radius-card)] bg-surface p-5", className)}>{children}</section>;
}

export function Field({
  label,
  hint,
  error,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; id: string }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          "min-h-[52px] rounded-xl border bg-surface px-4 text-base text-ink placeholder:text-muted/70",
          "hover:border-ink/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
          "disabled:bg-bg disabled:text-muted",
          error ? "border-danger" : "border-line-strong",
        )}
        {...input}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-info-bg text-info-ink",
    warn: "bg-warn-bg text-warn-ink",
    success: "bg-accent-tint text-accent-dark",
  };
  return (
    <div role="status" className={cx("rounded-xl px-4 py-3 text-sm font-semibold", tones[tone])}>
      {children}
    </div>
  );
}

/** Round initials avatar. `away` draws it dashed (SPEC §4.8). */
export function Avatar({ name, size = 40, away = false }: { name: string; size?: number; away?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        away ? "border-2 border-dashed border-line-strong text-muted" : "bg-accent-tint text-accent-dark",
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/** A card's heading row: title on the left, an optional count or link on the right. */
export function SectionHeading({
  title,
  meta,
  id,
}: {
  title: ReactNode;
  meta?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <h2 id={id} className="text-title font-bold">
        {title}
      </h2>
      {meta}
    </div>
  );
}

/** Small rounded count or status, e.g. "5 of 6 home". */
export function Pill({ tone = "accent", children }: { tone?: "accent" | "neutral"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
        tone === "accent" ? "bg-accent-tint text-accent-dark" : "bg-sunk text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** A grey block in the shape of content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("skeleton block rounded-lg", className)} aria-hidden="true" />;
}

export { cx };
