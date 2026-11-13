import "server-only";

import { GEMINI_SCAN_SCHEMA, ScanResult, SCAN_PROMPT, normalizeScan, type NormalizedScan } from "@/lib/engine/scan";
import { ProviderError, SCAN_TIMEOUT_MS, runChain, type Provider } from "./fallback";

/**
 * scanBill(image): one interface over the AI providers (SPEC §10). Keys stay
 * on the server; models are set by env so they can be swapped without code.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
/**
 * Backups when the main model is busy (503), out of free quota (429) or hangs.
 * Each model has its own free quota. (gemini-2.5-flash-lite is closed to new keys.)
 */
const GEMINI_BACKUP_MODELS = (process.env.GEMINI_BACKUP_MODELS || "gemini-3.5-flash-lite,gemini-3.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== GEMINI_MODEL);
const GROQ_MODEL = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

/** Per model: a multi-page e-bill takes longer to read than one photo. */
export const PDF_TIMEOUT_MS = 35_000;

function parseModelJson(text: string, provider: string): ScanResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new ProviderError(`${provider} returned text that isn't JSON`, 422);
  }
  const parsed = ScanResult.safeParse(json);
  if (!parsed.success) throw new ProviderError(`${provider} returned an unexpected shape`, 422);
  return parsed.data;
}

async function ensureOk(res: Response, provider: string) {
  if (!res.ok) throw new ProviderError(`${provider} HTTP ${res.status}`, res.status);
}

async function ensureGeminiOk(res: Response, name: string) {
  if (res.ok) return;
  // Keep Google's reason (e.g. "document has no pages") for the server log; never sent to the browser.
  const detail = await res.text().catch(() => "");
  throw new ProviderError(`${name} HTTP ${res.status}: ${detail.slice(0, 300)}`, res.status);
}

function gemini(base64: string, mime: BillMime, key: string, model: string, name: string): Provider<ScanResult> {
  return {
    name,
    async run(signal) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: SCAN_PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: GEMINI_SCAN_SCHEMA,
              temperature: 0,
              // Copying lines off a bill needs no reasoning; thinking only adds seconds.
              // Only 2.5 Flash takes this setting: 3.x models reject it with a 400.
              ...(/^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
        },
      );
      await ensureGeminiOk(res, name);
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      };
      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      // An empty or cut-off reply is worth one try on the fallback model.
      if (!text.trim()) throw new ProviderError(`${name} returned no text (${candidate?.finishReason ?? "no candidate"})`, 502);
      if (candidate?.finishReason === "MAX_TOKENS") throw new ProviderError(`${name} reply was cut off`, 502);
      return parseModelJson(text, name);
    },
  };
}

function groq(base64: string, key: string): Provider<ScanResult> {
  return {
    name: "groq",
    async run(signal) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: SCAN_PROMPT },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
              ],
            },
          ],
        }),
      });
      await ensureOk(res, "groq");
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return parseModelJson(body.choices?.[0]?.message?.content ?? "", "groq");
    },
  };
}

export class ScanUnavailableError extends Error {}

/** What a bill can be uploaded as: a compressed photo or a PDF. */
export type BillMime = "image/jpeg" | "application/pdf";

/**
 * Reads a bill photo or PDF, trying providers in order (runChain).
 * Photos: Gemini, Groq, then a backup Gemini model.
 * PDFs (Groq only takes images): Gemini, then the backup Gemini models, with a longer limit each.
 */
export async function scanBill(
  file: Uint8Array,
  mime: BillMime = "image/jpeg",
): Promise<{ scan: NormalizedScan; provider: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const pdf = mime === "application/pdf";
  const groqKey = pdf ? undefined : process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) throw new ScanUnavailableError("No AI key configured");

  const base64 = Buffer.from(file).toString("base64");
  const backups = geminiKey ? GEMINI_BACKUP_MODELS.map((m) => gemini(base64, mime, geminiKey, m, m)) : [];
  const providers: Provider<ScanResult>[] = [
    ...(geminiKey ? [gemini(base64, mime, geminiKey, GEMINI_MODEL, "gemini")] : []),
    ...(groqKey ? [groq(base64, groqKey)] : []),
    // A photo has Groq already, so one backup model is enough there.
    ...(pdf ? backups : backups.slice(0, 1)),
  ];
  const { result, provider } = await runChain(providers, pdf ? PDF_TIMEOUT_MS : SCAN_TIMEOUT_MS);
  return { scan: normalizeScan(result), provider };
}
