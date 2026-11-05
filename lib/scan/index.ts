import "server-only";

import { ScanResult, SCAN_PROMPT, normalizeScan, type NormalizedScan } from "@/lib/engine/scan";
import { ProviderError, runWithFallback, type Provider } from "./fallback";

/**
 * scanBill(image): one interface over the AI providers (SPEC §10). Keys stay
 * on the server; models are set by env so they can be swapped without code.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

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

function gemini(base64: string, key: string): Provider<ScanResult> {
  return {
    name: "gemini",
    async run(signal) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: SCAN_PROMPT }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
        },
      );
      await ensureOk(res, "gemini");
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return parseModelJson(text, "gemini");
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

export async function scanBill(image: Uint8Array): Promise<{ scan: NormalizedScan; provider: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) throw new ScanUnavailableError("No AI key configured");

  const base64 = Buffer.from(image).toString("base64");
  const providers = [geminiKey ? gemini(base64, geminiKey) : null, groqKey ? groq(base64, groqKey) : null].filter(
    (p): p is Provider<ScanResult> => p !== null,
  );
  const { result, provider } = await runWithFallback(providers[0], providers[1] ?? null);
  return { scan: normalizeScan(result), provider };
}
