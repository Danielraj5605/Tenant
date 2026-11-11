"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { deletePushSubscription, savePushSubscription, sendTestNotification } from "@/app/(app)/settings/push-actions";
import { Button, Notice } from "./ui";
import { BellIcon, XIcon } from "./icons";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "checking" | "unsupported" | "needs-install" | "no-worker" | "blocked" | "off" | "on" | "working" | "error";

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * The service worker, once it's active. The app registers it on load, so on a
 * first visit it may not exist yet: wait for it (and register it ourselves if
 * nothing has after a few seconds) instead of reporting "no worker".
 */
async function workerReady(timeoutMs = 8000): Promise<ServiceWorkerRegistration | null> {
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
  const first = await Promise.race([ready, timeout]);
  if (first) return first;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
  } catch {
    return null;
  }
}

/** This device's notification state, plus turning it on and off (SPEC §4.9). */
export function usePush() {
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: PushState;
      if (isIos() && !isStandalone()) next = "needs-install";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !VAPID_PUBLIC_KEY)
        next = "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await workerReady();
        if (!reg) next = "no-worker";
        else next = (await reg.pushManager.getSubscription()) && Notification.permission === "granted" ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = useCallback(async () => {
    setState("working");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await workerReady();
      if (!reg) return setState("no-worker");
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
      const { ok } = await savePushSubscription(sub.toJSON());
      setState(ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }, []);

  const turnOff = useCallback(async () => {
    setState("working");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }, []);

  return { state, turnOn, turnOff };
}

const WHAT = "Your duty each morning, chores others finish, new splits with your share, rent and bills before they're due, jobs handed to you, cook or maid leave, and a Sunday prompt for next week's away days.";

const COPY: Partial<Record<PushState, string>> = {
  "needs-install": "On iPhone, notifications only work after you add Tenant to your Home Screen (Share → Add to Home Screen), then open it from there.",
  unsupported: "This browser can't show notifications. Use Chrome or Edge on a computer or Android, or Safari after adding Tenant to your Home Screen.",
  "no-worker": "Notifications couldn't start in this browser window. Reload the page and try again.",
  blocked:
    "Notifications are blocked for this site. Click the icon left of the address bar (or open your phone's site settings), allow Notifications, then reload.",
  error: "Notifications couldn't be turned on. Check your connection and try again.",
};

/** Settings card: turn notifications on or off for this device, and send a test. */
export function PushSetup() {
  const { state, turnOn, turnOff } = usePush();
  const [test, setTest] = useState<{ pending: boolean; ok?: boolean; message?: string }>({ pending: false });

  async function sendTest() {
    setTest({ pending: true });
    const r = await sendTestNotification();
    setTest({ pending: false, ok: r.ok, message: r.message });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{WHAT}</p>
      {COPY[state] ? <Notice tone={state === "error" || state === "blocked" ? "warn" : "info"}>{COPY[state]}</Notice> : null}
      {state === "checking" ? <p className="text-sm text-muted">Checking this device…</p> : null}
      {state === "on" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-bold text-accent-dark">
              <BellIcon size={20} /> On for this device
            </span>
            <Button variant="ghost" className="w-auto" onClick={turnOff}>
              Turn off
            </Button>
          </div>
          <Button variant="secondary" onClick={sendTest} loading={test.pending}>
            Send a test notification
          </Button>
          {test.message ? <Notice tone={test.ok ? "success" : "warn"}>{test.message}</Notice> : null}
        </>
      ) : state === "off" || state === "working" || state === "error" ? (
        <Button onClick={turnOn} loading={state === "working"}>
          {state === "working" ? null : <BellIcon size={20} />}
          Turn on notifications
        </Button>
      ) : null}
    </div>
  );
}

const DISMISS_KEY = "tenant-notify-prompt-dismissed";
const noSubscribe = () => () => {};
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

/** Today: invite people to turn notifications on, until they do or say "Not now". */
export function NotifyPrompt() {
  const { state, turnOn } = usePush();
  // Hidden on the server and until the browser says it wasn't dismissed before.
  const dismissedBefore = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = dismissedBefore || dismissedNow;
  const [asked, setAsked] = useState(false);

  // Just turned on from here: say so once instead of vanishing.
  if (asked && state === "on") {
    return (
      <Notice tone="success">
        Notifications are on for this device. Send a test from Settings to see one arrive.
      </Notice>
    );
  }
  if (dismissed || !(state === "off" || state === "working" || state === "error" || state === "needs-install")) return null;

  const dismiss = () => {
    setDismissedNow(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Only hides it for this visit.
    }
  };

  return (
    <section aria-labelledby="notify-title" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 ring-2 ring-accent ring-inset">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-dark">
          <BellIcon size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="notify-title" className="font-bold">
            Get notified, even with Tenant closed
          </h2>
          <p className="text-sm text-muted">{state === "needs-install" ? COPY["needs-install"] : WHAT}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="-mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-ink"
        >
          <XIcon size={18} />
        </button>
      </div>
      {state === "error" ? <Notice tone="warn">{COPY.error}</Notice> : null}
      {state === "needs-install" ? null : (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Button
            onClick={() => {
              setAsked(true);
              void turnOn();
            }}
            loading={state === "working"}
          >
            {state === "working" ? null : <BellIcon size={20} />}
            Turn on notifications
          </Button>
          <Button variant="ghost" onClick={dismiss} className="px-4">
            Not now
          </Button>
        </div>
      )}
    </section>
  );
}
