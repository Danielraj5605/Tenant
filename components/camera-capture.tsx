"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cx } from "./ui";
import { CameraIcon, XIcon } from "./icons";

/**
 * "Take a photo" on every screen. Phones and touch tablets use the native
 * camera (best photo quality, via `capture`); laptops and desktops ignore
 * `capture`, so they get an in-app camera with a live preview instead.
 */
export function TakePhotoButton({ onFile, className }: { onFile: (file: File) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const start = () => {
    // Touch-first devices honour `capture` and open the camera app.
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (touch || !navigator.mediaDevices?.getUserMedia) inputRef.current?.click();
    else setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={cx(
          "flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-white transition-colors hover:bg-accent-dark",
          className,
        )}
      >
        <CameraIcon size={20} />
        Take a photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      {open ? (
        <CameraDialog
          onClose={() => setOpen(false)}
          onPhoto={(file) => {
            setOpen(false);
            onFile(file);
          }}
        />
      ) : null}
    </>
  );
}

type CameraState = { kind: "starting" } | { kind: "live" } | { kind: "error"; message: string };

function CameraDialog({ onClose, onPhoto }: { onClose: () => void; onPhoto: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<CameraState>({ kind: "starting" });
  const [taking, setTaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setState({ kind: "live" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setState({
          kind: "error",
          message:
            name === "NotAllowedError" || name === "SecurityError"
              ? "Camera access is blocked. Allow the camera for this site in your browser, or upload a photo instead."
              : name === "NotFoundError" || name === "OverconstrainedError"
                ? "No camera was found on this device. Upload a photo or PDF instead."
                : name === "NotReadableError"
                  ? "The camera is being used by another app. Close it and try again, or upload a photo instead."
                  : "The camera couldn't start. Upload a photo or PDF instead.",
        });
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (state.kind === "live") shutterRef.current?.focus();
  }, [state.kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setTaking(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        setTaking(false);
        if (blob) onPhoto(new File([blob], `bill-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="camera-title" className="text-title font-bold">
            Take a photo of the bill
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-ink"
          >
            <XIcon size={20} />
          </button>
        </div>

        {state.kind === "error" ? (
          <p role="alert" className="rounded-xl bg-warn-bg px-4 py-3 font-semibold text-warn-ink">
            {state.message}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-ink">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-contain" />
            {state.kind === "starting" ? (
              <p className="absolute inset-0 flex items-center justify-center font-semibold text-white">Starting the camera…</p>
            ) : null}
          </div>
        )}

        <p className="text-sm text-muted">Lay the bill flat in good light and fill the frame with it.</p>

        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="px-5">
            Cancel
          </Button>
          {state.kind === "error" ? null : (
            <Button ref={shutterRef} type="button" onClick={snap} disabled={state.kind !== "live"} loading={taking}>
              {taking ? null : <CameraIcon size={20} />}
              Take photo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
