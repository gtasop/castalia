import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { errorQuery } from "@/lib/flash";
import { GOOGLE_FLOW_COOKIE } from "@/lib/google-cookies";
import { GOOGLE_FLOW_SECONDS, googleEnabled, googleHost, googleStartUrl, startGoogleFlow } from "@/lib/google";
import { allow, clientIp } from "@/lib/rate-limit";
import { safeNext } from "@/lib/redirect";
import { seal } from "@/lib/signed";

// Sends the browser to Google's account chooser. With ?link=1, a logged-in
// person connects Google to their account instead of signing in.
export async function GET(req: NextRequest) {
  const link = req.nextUrl.searchParams.get("link") === "1";
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  if (!googleEnabled()) redirect(`/login?${errorQuery("Google sign-in isn't set up on this server")}`);
  // Google returns to APP_URL. Started from another address (127.0.0.1, a
  // LAN IP), the attempt's cookie would stay with that address and never
  // come back, so restart it on APP_URL first.
  if ((await headers()).get("host") !== googleHost()) redirect(googleStartUrl(req.nextUrl.search));
  if (!allow(`google:${await clientIp()}`, 30, 900)) redirect(`/login?${errorQuery("Too many attempts. Wait 15 minutes and try again.")}`);
  if (link && !(await currentUser())) redirect("/login?next=/account");

  const { flow, url } = startGoogleFlow(next, link);
  (await cookies()).set(GOOGLE_FLOW_COOKIE, seal("google-flow", flow, GOOGLE_FLOW_SECONDS), {
    httpOnly: true,
    sameSite: "lax", // sent when Google redirects back (a top-level GET)
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: GOOGLE_FLOW_SECONDS,
  });
  redirect(url);
}
