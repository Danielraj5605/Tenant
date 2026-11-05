"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChoresIcon, HomeIcon, MenuIcon, MoneyIcon } from "./icons";
import { cx } from "./ui";

const TABS = [
  { href: "/today", label: "Today", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/chores", label: "Chores", Icon: ChoresIcon },
  { href: "/menu", label: "Menu", Icon: MenuIcon },
  { href: "/money", label: "Money", Icon: MoneyIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-[430px] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold",
                  active ? "text-accent-dark" : "text-muted hover:text-ink",
                )}
              >
                <span
                  className={cx(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-accent-tint" : "group-hover:bg-line/60",
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
  );
}
