import { createHash, randomBytes } from "node:crypto";

// "Sign in with Google" over OpenID Connect: the authorization code flow
// with PKCE, a state value and a nonce. The ID token comes straight from
// Google's token endpoint over TLS, so (as OpenID Connect allows) its
// claims are checked instead of its signature.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Lifetime of the sign-in attempt (Google's page) and of a pending sign-up. */
export const GOOGLE_FLOW_SECONDS = 10 * 60;
export const GOOGLE_SIGNUP_SECONDS = 30 * 60;

const clientId = () => process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET ?? "";
const redirectUri = () => `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

/** Google sign-in shows only when both keys are set. */
export const googleEnabled = () => Boolean(clientId() && clientSecret());

/** What the browser keeps (sealed, in a cookie) while it is on Google's page. */
export type GoogleFlow = { state: string; nonce: string; verifier: string; next: string; link: boolean };

export function startGoogleFlow(next: string, link: boolean): { flow: GoogleFlow; url: string } {
  const token = () => randomBytes(32).toString("base64url");
  const flow: GoogleFlow = { state: token(), nonce: token(), verifier: token(), next, link };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { flow, url: url.toString() };
}

export type GoogleProfile = { sub: string; email: string; name: string };

/** Swaps the code from Google's redirect for the person's verified profile. */
export async function finishGoogleFlow(code: string, flow: GoogleFlow): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new GoogleSignInError(`Google refused the sign-in (${res.status})`);
  const { id_token } = (await res.json()) as { id_token?: unknown };
  return checkIdToken(id_token, { clientId: clientId(), nonce: flow.nonce, now: Date.now() });
}

export class GoogleSignInError extends Error {}

/** Reads the ID token and checks it is for us, fresh, from this attempt, and has a verified email. */
export function checkIdToken(token: unknown, expect: { clientId: string; nonce: string; now: number }): GoogleProfile {
  const fail = (why: string): never => {
    throw new GoogleSignInError(why);
  };
  if (typeof token !== "string") fail("No ID token");
  const parts = (token as string).split(".");
  if (parts.length !== 3) fail("Malformed ID token");
  let c: Record<string, unknown> = {};
  try {
    c = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    fail("Malformed ID token");
  }
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!ISSUERS.includes(c.iss as string)) fail("Wrong issuer");
  if (!expect.clientId || !aud.includes(expect.clientId)) fail("Wrong audience");
  if (typeof c.exp !== "number" || c.exp * 1000 <= expect.now) fail("Expired ID token");
  if (c.nonce !== expect.nonce) fail("Wrong nonce");
  if (typeof c.sub !== "string" || !c.sub) fail("No account id");
  if (typeof c.email !== "string" || !c.email || c.email_verified !== true) fail("No verified email");
  const email = (c.email as string).trim().toLowerCase();
  const name = typeof c.name === "string" && c.name.trim() ? c.name : email.split("@")[0];
  return { sub: c.sub as string, email, name };
}
