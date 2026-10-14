import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { GOOGLE_SIGNUP_COOKIE, GOOGLE_SIGNUP_PURPOSE, type PendingGoogleSignup } from "@/lib/google-cookies";
import { unseal } from "@/lib/signed";
import { googleSignup } from "../../actions";
import { RolePicker } from "../role-picker";

export const metadata = { title: "Finish signing up" };

export default async function GoogleSignupPage() {
  const pending = unseal<PendingGoogleSignup>(GOOGLE_SIGNUP_PURPOSE, (await cookies()).get(GOOGLE_SIGNUP_COOKIE)?.value);
  if (!pending) redirect("/signup");
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-2">Almost there</h1>
      <p className="mb-6 text-sm text-muted">
        You&apos;re signing up with Google as <strong className="text-fg [overflow-wrap:anywhere]">{pending.email}</strong>. You&apos;ll
        log in with Google, no password needed.
      </p>
      <ActionForm action={googleSignup} className="space-y-4">
        <RolePicker />
        <div>
          <label className="label" htmlFor="name">Name (artists: your artist name)</label>
          <input className="input" id="name" name="name" autoComplete="name" maxLength={100} defaultValue={pending.name.slice(0, 100)} required />
        </div>
        <button className="btn w-full">Create account</button>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Not you?{" "}
        <Link href="/signup" className="link">
          Sign up another way
        </Link>
      </p>
    </div>
  );
}
