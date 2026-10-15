import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Short-lived values the app hands to the browser and must get back
// unchanged (error messages in URLs, the Google sign-in cookies). Each one is
// signed for one purpose, so a value made for one use can't be replayed in
// another.

// Without SESSION_SECRET, a random key is made once per server process and
// kept on globalThis: module-level state would be remade whenever the dev
// server recompiles a route, so a Google sign-in started before a recompile
// couldn't be checked after it. A restart still changes the key, so set
// SESSION_SECRET anywhere that matters.
const g = globalThis as typeof globalThis & { castaliaSecret?: string };
if (!process.env.SESSION_SECRET && !g.castaliaSecret && process.env.NODE_ENV === "production") {
  console.warn("SESSION_SECRET is not set: signed links and Google sign-ins will break on every restart.");
}
const secret = process.env.SESSION_SECRET || (g.castaliaSecret ??= randomBytes(32).toString("hex"));

export function hmac(msg: string) {
  return createHmac("sha256", secret).update(msg).digest("base64url");
}

/** True when `given` is the signature `expected`, compared in constant time. */
export function sameSignature(expected: string, given: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Packs `data` into a signed string that expires after `ttlSec`. */
export function seal(purpose: string, data: object, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlSec * 1000 })).toString("base64url");
  return `${body}.${hmac(`${purpose}.${body}`)}`;
}

/** The data packed by `seal`, or null if it was changed, expired or made for another purpose. */
export function unseal<T>(purpose: string, value: string | undefined): T | null {
  if (!value) return null;
  const [body, sig, extra] = value.split(".");
  if (!body || !sig || extra !== undefined || !sameSignature(hmac(`${purpose}.${body}`), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof data === "object" && data && typeof data.exp === "number" && data.exp > Date.now() ? (data as T) : null;
  } catch {
    return null;
  }
}
