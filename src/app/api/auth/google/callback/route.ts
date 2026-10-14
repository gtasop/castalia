import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSession, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorQuery } from "@/lib/flash";
import { GOOGLE_FLOW_COOKIE, GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_PURPOSE, type PendingGoogleSignup } from "@/lib/google-cookies";
import { finishGoogleFlow, GOOGLE_SIGNUP_SECONDS, GoogleSignInError, type GoogleFlow, type GoogleProfile } from "@/lib/google";
import { sameSignature, seal, unseal } from "@/lib/signed";
import { setThemeCookie, toThemePref } from "@/lib/theme";

// Google sends the browser back here after the person picks an account.
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const flow = unseal<GoogleFlow>("google-flow", jar.get(GOOGLE_FLOW_COOKIE)?.value);
  jar.delete({ name: GOOGLE_FLOW_COOKIE, path: "/api/auth/google" });
  const q = req.nextUrl.searchParams;
  const state = q.get("state") ?? "";
  const code = q.get("code");

  // No attempt from this browser, or one that doesn't match: start again.
  if (!flow || !sameSignature(flow.state, state)) fail("/login", "That Google sign-in expired. Try again.");
  const from = flow!.link ? "/account" : "/login";
  // The person closed Google's page or said no: back where they were, no fuss.
  if (q.get("error") || !code) redirect(from);

  let profile: GoogleProfile;
  try {
    profile = await finishGoogleFlow(code!, flow!);
  } catch (e) {
    if (e instanceof GoogleSignInError) fail(from, "Google sign-in didn't work. Try again, or use your email and password.");
    throw e;
  }

  if (flow!.link) return connect(profile!);

  const known = await db.user.findUnique({ where: { googleId: profile!.sub } });
  if (known) {
    await createSession(known.id);
    await setThemeCookie(toThemePref(known.theme));
    redirect(flow!.next);
  }
  // An account with this email that never used Google: Castalia doesn't
  // verify emails, so anyone could have made it. Only its password holder
  // may connect Google to it (from the account page).
  if (await db.user.findUnique({ where: { email: profile!.email }, select: { id: true } })) {
    fail("/login", "An account with this email already exists. Log in with your password, then connect Google from your account page.");
  }
  const pending: PendingGoogleSignup = { ...profile!, next: flow!.next };
  jar.set(GOOGLE_SIGNUP_COOKIE, seal(GOOGLE_SIGNUP_PURPOSE, pending, GOOGLE_SIGNUP_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/signup",
    maxAge: GOOGLE_SIGNUP_SECONDS,
  });
  redirect("/signup/google");
}

async function connect(profile: GoogleProfile) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const owner = await db.user.findUnique({ where: { googleId: profile.sub }, select: { id: true } });
  if (owner && owner.id !== user!.id) fail("/account", "That Google account is already connected to another Castalia account.");
  await db.user.update({ where: { id: user!.id }, data: { googleId: profile.sub } });
  redirect("/account?google=connected");
}

function fail(path: string, msg: string): never {
  redirect(`${path}?${errorQuery(msg)}`);
}
