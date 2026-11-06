"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AlertIcon } from "@/components/icons";

/** When we last retried by ourselves; one automatic retry per 15 s, so a real outage doesn't loop. */
let lastAutoRetry = 0;

/**
 * Shown when a page fails to load, most often a dropped connection on a phone.
 * It retries once by itself, then offers Try again.
 */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(() => Date.now() - lastAutoRetry > 15_000);

  useEffect(() => {
    console.error(error);
    if (!retrying) return;
    lastAutoRetry = Date.now();
    const id = setTimeout(() => {
      retry();
      setRetrying(false);
    }, 1200);
    return () => clearTimeout(id);
  }, [error, retry, retrying]);

  return (
    <main className="flex flex-1 flex-col justify-center gap-5 px-6 py-12" aria-live="polite">
      <AlertIcon size={32} className="text-warn-ink" />
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-extrabold">This page didn&rsquo;t load</h1>
        <p className="text-muted">
          {retrying ? "Trying again…" : "Usually a dropped connection. Check your internet and try again."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={() => retry()} loading={retrying}>
          Try again
        </Button>
        <Link
          href="/today"
          className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line-strong bg-surface font-bold hover:bg-bg"
        >
          Go to Today
        </Link>
      </div>
    </main>
  );
}
