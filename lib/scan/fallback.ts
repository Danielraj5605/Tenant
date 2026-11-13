/**
 * Provider fallback (SPEC §10.3): on HTTP 429, a 5xx, a reply that isn't the
 * expected JSON (422) or a timeout, retry once with the fallback provider.
 * Other errors (e.g. 400, a file the AI refuses) are not retried.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly timedOut = false,
  ) {
    super(message);
  }
}

export const SCAN_TIMEOUT_MS = 20_000;

export const shouldFallback = (err: unknown) =>
  err instanceof ProviderError &&
  (err.timedOut || err.status === 429 || err.status === 422 || (err.status !== null && err.status >= 500));

export type Provider<T> = { name: string; run: (signal: AbortSignal) => Promise<T> };

async function withTimeout<T>(p: Provider<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p.run(ctrl.signal);
  } catch (err) {
    if (ctrl.signal.aborted) throw new ProviderError(`${p.name} timed out`, null, true);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function runWithFallback<T>(
  primary: Provider<T>,
  fallback: Provider<T> | null,
  timeoutMs = SCAN_TIMEOUT_MS,
): Promise<{ result: T; provider: string }> {
  return runChain(fallback ? [primary, fallback] : [primary], timeoutMs);
}

/**
 * Tries each provider in order, moving on only for errors worth a retry
 * (shouldFallback). Free Gemini models are often busy (503) or out of quota
 * (429), so a chain of different models gets a bill read far more often.
 */
export async function runChain<T>(providers: Provider<T>[], timeoutMs = SCAN_TIMEOUT_MS): Promise<{ result: T; provider: string }> {
  let lastErr: unknown = new Error("No provider configured");
  for (const [i, p] of providers.entries()) {
    try {
      return { result: await withTimeout(p, timeoutMs), provider: p.name };
    } catch (err) {
      lastErr = err;
      if (!shouldFallback(err)) throw err;
      if (i < providers.length - 1) console.warn(`scan: ${p.name} failed, trying ${providers[i + 1].name}:`, (err as Error).message);
    }
  }
  throw lastErr;
}
