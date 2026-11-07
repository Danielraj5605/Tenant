import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/auth/server";
import { ScanUnavailableError, scanBill, type BillMime } from "@/lib/scan";

/** Max sizes: photos are compressed in the browser to ~200 KB; PDFs are sent as-is. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** Vercel caps a request body at 4.5 MB. */
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const isPdf = (bytes: Uint8Array) =>
  bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // "%PDF"
const isJpeg = (bytes: Uint8Array) => bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

/**
 * POST /api/scan (multipart, field "photo": a JPEG photo or a PDF) → returns the
 * parsed items for review (SPEC §10). The file is only read, never stored
 * (user's choice, 2026-11-07).
 * The only route that talks to AI; keys never reach the browser. Nothing is
 * saved to the ledger here.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("flat_id")
    .eq("user_id", userId)
    .is("left_on", null)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Join a flat first." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "Attach a photo or PDF of the bill." }, { status: 400 });
  if (file.type !== "image/jpeg" && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Upload a photo or a PDF." }, { status: 415 });
  }
  const mime: BillMime = file.type;
  const max = mime === "application/pdf" ? MAX_PDF_BYTES : MAX_PHOTO_BYTES;
  if (file.size > max) {
    return NextResponse.json({ error: mime === "application/pdf" ? "That PDF is over 4 MB." : "The photo is too large." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Check the content, not just the declared type.
  if (mime === "application/pdf" ? !isPdf(bytes) : !isJpeg(bytes)) {
    return NextResponse.json({ error: "That file isn't a readable photo or PDF." }, { status: 415 });
  }
  try {
    const { scan, provider } = await scanBill(bytes, mime);
    return NextResponse.json({ ...scan, provider });
  } catch (err) {
    if (err instanceof ScanUnavailableError) {
      return NextResponse.json({ error: "Bill scanning isn't set up yet. Use New split for now." }, { status: 503 });
    }
    console.error("scan failed", err);
    return NextResponse.json(
      {
        error:
          mime === "application/pdf"
            ? "This PDF couldn't be read. Try a photo of the bill, or use New split."
            : "This bill couldn't be read. Try a clearer, flatter photo, or use New split.",
      },
      { status: 502 },
    );
  }
}
