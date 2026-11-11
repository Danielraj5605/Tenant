import Link from "next/link";
import { AlertIcon } from "@/components/icons";

/**
 * Inside the app (a split, chore or away entry that was deleted, or a bad link):
 * keeps the tab bar so people can carry on.
 */
export default function NotFoundInApp() {
  return (
    <div className="flex flex-col gap-5 py-10">
      <AlertIcon size={32} className="text-warn-ink" />
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-extrabold">Not found</h1>
        <p className="text-muted">
          This may have been deleted by a flatmate, or the link is wrong. Everything else is where you left it.
        </p>
      </div>
      <Link
        href="/today"
        className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-dark md:w-fit"
      >
        Go to Today
      </Link>
    </div>
  );
}
