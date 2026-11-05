"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { ShareIcon } from "./icons";
import { isIos, isStandalone } from "./push-setup";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "tenant-install-dismissed";

/**
 * Walks people through installing the PWA (SPEC §4.9: on iPhone, push only
 * works after "Add to Home Screen"). Hidden once installed or dismissed.
 */
export function InstallCard() {
  const [mode, setMode] = useState<"hidden" | "ios" | "android">("hidden");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
    // Decided after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos()) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setMode("hidden");
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-bold">Add Tenant to your Home Screen</h2>
      {mode === "ios" ? (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Tap <ShareIcon size={16} className="inline align-text-bottom" aria-label="Share" /> Share in Safari&rsquo;s
            toolbar.
          </li>
          <li>Scroll down and tap Add to Home Screen.</li>
          <li>Open Tenant from your Home Screen, then turn on reminders in Settings.</li>
        </ol>
      ) : (
        <>
          <p className="text-muted">It opens like an app and can remind you about your duties.</p>
          <Button
            onClick={async () => {
              await prompt?.prompt();
              const choice = await prompt?.userChoice;
              if (choice?.outcome === "accepted") setMode("hidden");
            }}
          >
            Install Tenant
          </Button>
        </>
      )}
      <Button variant="ghost" onClick={dismiss}>
        Not now
      </Button>
    </Card>
  );
}
