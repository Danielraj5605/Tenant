/**
 * Provider fallback (SPEC §10.3): on HTTP 429, a 5xx or a timeout over 20 s,
 * retry once with the fallback provider. Other errors are not retried.
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
  err instanceof ProviderError && (err.timedOut || err.status === 429 || (err.status !== null && err.status >= 500));

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
  try {
    return { result: await withTimeout(primary, timeoutMs), provider: primary.name };
  } catch (err) {
    if (!fallback || !shouldFallback(err)) throw err;
    return { result: await withTimeout(fallback, timeoutMs), provider: fallback.name };
  }
}
