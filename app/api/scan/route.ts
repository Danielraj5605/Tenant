import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ScanUnavailableError, scanBill } from "@/lib/scan";

const Body = z.object({ imagePath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/) });

/** Max bill image size accepted (client compresses to ~200 KB). */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/scan { imagePath } → parsed bill items for review (SPEC §10).
 * The only server route that talks to AI; keys never reach the browser.
 * Nothing is saved here.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad image path." }, { status: 400 });
  const { imagePath } = parsed.data;

  // The image must be in the caller's flat folder; storage RLS enforces it too.
  const flatId = imagePath.split("/")[0];
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("flat_id", flatId)
    .eq("user_id", auth.claims.sub)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "This bill isn't in your flat." }, { status: 403 });

  const { data: file, error } = await supabase.storage.from("bills").download(imagePath);
  if (error || !file) return NextResponse.json({ error: "The photo couldn't be found. Upload it again." }, { status: 404 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The photo is too large." }, { status: 413 });

  try {
    const { scan, provider } = await scanBill(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ ...scan, provider });
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
