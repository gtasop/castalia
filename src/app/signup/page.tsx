import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { JamArt } from "@/components/art";
import { GoogleButton } from "@/components/google-button";
import { Notice } from "@/components/ui";
import { verifiedError } from "@/lib/flash";
import { safeNext } from "@/lib/redirect";
import { signup } from "../actions";
import { RolePicker } from "./role-picker";

export const metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string; sig?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <div className="mx-auto grid max-w-4xl items-center gap-x-14 gap-y-12 md:grid-cols-2">
      <div className="w-full max-w-sm justify-self-center md:order-last">
        <h1 className="h1 mb-6">Create an account</h1>
        <Notice error={verifiedError(sp)} />
        <GoogleButton next={next} />
        <ActionForm action={signup} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <RolePicker />
          <div>
            <label className="label" htmlFor="name">Name (artists: your artist name)</label>
            <input className="input" id="name" name="name" autoComplete="name" maxLength={100} required />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password (8 or more characters)</label>
            <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
          </div>
          <button className="btn w-full">Create account</button>
        </ActionForm>
        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="link">
            Log in
          </Link>
        </p>
      </div>
      <JamArt className="mx-auto w-full max-w-xs md:max-w-sm" />
    </div>
  );
}
