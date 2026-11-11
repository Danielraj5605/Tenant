"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Pages already shown in this session: the router may serve these from its cache. */
const visited = new Set<string>();

/** Back to the app after this long: refresh what's on screen. */
const AWAY_MS = 15_000;

/**
 * Tabs open instantly from the router's cache (staleTimes in next.config.ts),
 * which can be up to 60 s old when a flatmate changed something. This keeps the
 * instant open and then quietly fetches the latest data:
 * - when you return to a page you've already seen this session;
 * - when you come back to the app after being away for a while.
 * router.refresh() swaps the new data in without a loading state.
 */
export function RouteRefresher() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const key = `${pathname}?${search}`;
    if (visited.has(key)) {
      const id = setTimeout(() => router.refresh(), 150);
      return () => clearTimeout(id);
    }
    visited.add(key);
  }, [pathname, search, router]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > AWAY_MS) {
        hiddenAt.current = null;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}
