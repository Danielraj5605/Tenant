import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/auth/server";
import { ScanUnavailableError, scanBill } from "@/lib/scan";

/** Max bill photo size accepted (the browser compresses to ~200 KB). */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/scan (multipart, field "photo") → stores the photo privately at
 * bills/<flat_id>/<uuid>.jpg and returns parsed items for review (SPEC §10).
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
  const photo = form?.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return NextResponse.json({ error: "Attach a photo." }, { status: 400 });
  if (photo.type !== "image/jpeg") return NextResponse.json({ error: "Upload a JPEG photo." }, { status: 415 });
  if (photo.size > MAX_BYTES) return NextResponse.json({ error: "The photo is too large." }, { status: 413 });

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const imagePath = `${member.flat_id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from("bills").upload(imagePath, bytes, { contentType: "image/jpeg" });
  if (upErr) return NextResponse.json({ error: "The photo couldn't be stored. Try again." }, { status: 500 });

  try {
    const { scan, provider } = await scanBill(bytes);
    return NextResponse.json({ ...scan, imagePath, provider });
  } catch (err) {
    if (err instanceof ScanUnavailableError) {
      return NextResponse.json({ error: "Bill scanning isn't set up yet. Use New split for now." }, { status: 503 });
    }
    console.error("scan failed", err);
    return NextResponse.json(
      { error: "This bill couldn't be read. Try a clearer, flatter photo, or use New split." },
      { status: 502 },
    );
  }
}
