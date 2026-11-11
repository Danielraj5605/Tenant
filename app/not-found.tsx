import Link from "next/link";
import { AlertIcon } from "@/components/icons";

export const metadata = { title: "Page not found · Tenant" };

/** Any address that isn't part of the app (a typo, an old or shared link). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center gap-5 px-6 py-12 md:max-w-[560px]">
      <AlertIcon size={32} className="text-warn-ink" />
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-extrabold">Page not found</h1>
        <p className="text-muted">This link doesn&rsquo;t go anywhere in Tenant. It may be mistyped, or the page has moved.</p>
      </div>
      <Link
        href="/today"
        className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-dark"
      >
        Go to Today
      </Link>
    </main>
  );
}
