import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Error messages travel in the URL after a redirect (?error=…). They are
// signed, so a link someone crafts with their own text (fake warnings,
// phishing instructions) is ignored instead of shown as an official alert.

const secret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

function sign(msg: string) {
  return createHmac("sha256", secret).update(msg).digest("base64url").slice(0, 22);
}

/** Query string fragment carrying a signed error message. */
export function errorQuery(msg: string) {
  return `error=${encodeURIComponent(msg)}&sig=${sign(msg)}`;
}

/** The error from searchParams, only if the app itself put it there. */
export function verifiedError(sp: { error?: string | string[]; sig?: string | string[] }): string | undefined {
  const msg = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const sig = Array.isArray(sp.sig) ? sp.sig[0] : sp.sig;
  if (!msg || !sig) return undefined;
  const expected = Buffer.from(sign(msg));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? msg : undefined;
}
