"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/(app)/settings/push-actions";
import { Button, Notice } from "./ui";
import { BellIcon } from "./icons";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "no-worker"
  | "blocked"
  | "off"
  | "on"
  | "working"
  | "error";

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Turn duty reminders and leave alerts on or off for this device (SPEC §4.9). */
export function PushSetup() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (isIos() && !isStandalone()) next = "needs-install";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) next = "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) next = "no-worker";
        else next = (await reg.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setState("working");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
        }));
      const { ok } = await savePushSubscription(sub.toJSON());
      setState(ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }

  async function turnOff() {
    setState("working");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  const copy: Partial<Record<State, string>> = {
    "needs-install": "On iPhone, reminders only work after you add Tenant to your Home Screen. See the steps on Today.",
    unsupported: "This browser can't show reminders. Try Chrome on Android, or Safari after adding Tenant to your Home Screen.",
    "no-worker": "Reminders work in the installed app. Open Tenant from your Home Screen to turn them on.",
    blocked: "Notifications are blocked for Tenant. Allow them in your phone's settings, then come back here.",
    error: "Reminders couldn't be turned on. Check your connection and try again.",
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        A reminder on days you have a duty, an alert when the cook or maid is on leave, and a Sunday prompt to mark next
        week&rsquo;s away days.
      </p>
      {copy[state] ? <Notice tone={state === "error" || state === "blocked" ? "warn" : "info"}>{copy[state]}</Notice> : null}
      {state === "on" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-bold text-accent-dark">
            <BellIcon size={20} /> Reminders are on
          </span>
          <Button variant="ghost" className="w-auto" onClick={turnOff}>
            Turn off
          </Button>
        </div>
      ) : state === "off" || state === "working" || state === "error" ? (
        <Button onClick={turnOn} loading={state === "working"}>
          {state === "working" ? null : <BellIcon size={20} />}
          Turn on reminders
        </Button>
      ) : null}
    </div>
  );
}
