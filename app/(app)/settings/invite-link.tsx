"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { CheckIcon, CopyIcon, ShareIcon } from "@/components/icons";

const noopSubscribe = () => () => {};

export function InviteLink({ url, flatName }: { url: string; flatName: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // Read after hydration so server and client markup match.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${flatName} on Tenant`, url });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <output
        className="block rounded-xl border border-line-strong bg-bg px-4 py-3 text-sm font-semibold break-all select-all"
        aria-label="Invite link"
      >
        {url}
      </output>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={copy} aria-live="polite">
          {copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        {canShare ? (
          <Button onClick={share}>
            <ShareIcon size={20} />
            Share
          </Button>
        ) : null}
      </div>
      {copyFailed ? (
        <p className="text-sm font-semibold text-danger" role="alert">
          Copying isn&rsquo;t allowed here. Press and hold the link to copy it.
        </p>
      ) : null}
    </div>
  );
}
