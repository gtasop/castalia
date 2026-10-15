import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { GoogleButton } from "@/components/google-button";
import { Notice } from "@/components/ui";
import { verifiedError } from "@/lib/flash";
import { safeNext } from "@/lib/redirect";
import { login } from "../actions";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string; sig?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-6">Log in</h1>
      <Notice error={verifiedError(sp)} />
      <GoogleButton next={next} />
      <ActionForm action={login} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot" className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
              Forgot your password?
            </Link>
          </div>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">Log in</button>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        New here?{" "}
        <Link href={next !== "/" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="link">
          Create an account
        </Link>
      </p>
    </div>
  );
}
