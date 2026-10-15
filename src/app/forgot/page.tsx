import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Notice } from "@/components/ui";
import { verifiedError } from "@/lib/flash";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Forgot your password?" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string; sig?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-2">Forgot your password?</h1>
      <p className="mb-6 text-sm text-muted">
        Enter your account&apos;s email and we&apos;ll send you a link to choose a new one. If you sign in with Google, this sets a password
        you can use as well.
      </p>
      <Notice error={verifiedError(sp)} />
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
        </div>
        <button className="btn w-full">Send me a link</button>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </div>
  );
}
