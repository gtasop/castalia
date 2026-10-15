import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { findReset } from "@/lib/password-reset";
import { resetPassword } from "../actions";

// The token is in this page's address: never send it on to other sites.
// ("no-referrer" would go further but makes browsers send `Origin: null`
// with the form, which the server action's origin check rejects.)
export const metadata = { title: "Choose a new password", referrer: "same-origin" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const reset = await findReset(token);

  if (!reset) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="h1 mb-2">This link doesn&apos;t work</h1>
        <p className="text-sm text-muted">
          It has expired or was already used. Links work once, for an hour, and only the newest one you asked for works.
        </p>
        <Link href="/forgot" className="btn mt-6">
          Send me a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-2">Choose a new password</h1>
      <p className="mb-6 text-sm text-muted [overflow-wrap:anywhere]">
        For <strong className="text-fg">{reset.user.email}</strong>. You&apos;ll be logged out everywhere else.
      </p>
      <ActionForm action={resetPassword} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="username" value={reset.user.email} autoComplete="username" readOnly hidden />
        <div>
          <label className="label" htmlFor="password">New password (8 or more characters)</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <div>
          <label className="label" htmlFor="confirm">The same again</label>
          <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </div>
        <button className="btn w-full">Save new password</button>
      </ActionForm>
    </div>
  );
}
