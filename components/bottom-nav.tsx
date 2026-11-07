"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChoresIcon, HomeIcon, MenuIcon, MoneyIcon, SettingsIcon } from "./icons";
import { cx } from "./ui";

const TABS = [
  { href: "/today", label: "Today", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/chores", label: "Chores", Icon: ChoresIcon },
  { href: "/menu", label: "Menu", Icon: MenuIcon },
  { href: "/money", label: "Money", Icon: MoneyIcon },
] as const;

const isActive = (pathname: string | null, href: string) =>
  pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));

/**
 * Bottom tab bar on phones and tablets; a left rail on desktop (≥1024 px).
 * Wrapped in Suspense: the active tab depends on the URL.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavBar pathname={usePathname()} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-md backdrop-saturate-150 lg:hidden"
      >
        <ul className="mx-auto flex max-w-[560px] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "group flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors",
                    active ? "text-accent-dark" : "text-muted hover:text-ink",
                  )}
                >
                  <span
                    className={cx(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active ? "bg-accent-tint" : "group-hover:bg-sunk",
                    )}
                  >
                    <Icon size={20} strokeWidth={active ? 2.25 : 2} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-surface/60 px-4 pt-8 pb-6 lg:flex"
      >
        <Link href="/today" className="mb-8 flex items-center gap-2.5 rounded-xl px-3 py-1">
          <span className="flex gap-1" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-accent" />
            <span className="size-2.5 rounded-full bg-accent" />
            <span className="size-2.5 rounded-full border-[1.5px] border-dashed border-muted" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">Tenant</span>
        </Link>
        <ul className="flex flex-col gap-1">
          {TABS.map(({ href, label, Icon }) => (
            <RailLink key={href} href={href} label={label} Icon={Icon} active={isActive(pathname, href)} />
          ))}
        </ul>
        <ul className="mt-auto flex flex-col gap-1">
          <RailLink href="/settings" label="Settings" Icon={SettingsIcon} active={isActive(pathname, "/settings")} />
        </ul>
      </nav>
    </>
  );
}

function RailLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: (p: { size?: number; strokeWidth?: number }) => React.ReactNode;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors",
          active ? "bg-accent-tint text-accent-dark" : "text-muted hover:bg-sunk hover:text-ink",
        )}
      >
        <Icon size={20} strokeWidth={active ? 2.25 : 2} />
        {label}
      </Link>
    </li>
  );
}
