/**
 * Signed session tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * Uses Web Crypto so it works in the proxy and in server code.
 */
export type SessionPayload = { uid: string; exp: number };

export const SESSION_COOKIE = "tenant_session";
/** Sessions slide: any visit after a day renews them for this long again. */
export const SESSION_DAYS = 180;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const RENEW_AFTER_SECONDS = 24 * 60 * 60;

export const newSessionPayload = (uid: string, now = Date.now()): SessionPayload => ({
  uid,
  exp: Math.floor(now / 1000) + SESSION_SECONDS,
});

/** True when the session was issued more than a day ago and should be renewed. */
export const shouldRenew = (s: SessionPayload, now = Date.now()) =>
  s.exp - Math.floor(now / 1000) < SESSION_SECONDS - RENEW_AFTER_SECONDS;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://"),
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await key(secret), Buffer.from(sig, "base64url"), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}
