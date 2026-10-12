import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { safeNext } from "@/lib/redirect";
import { signup } from "../actions";

export const metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const sp = await searchParams;
  const next = safeNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-6">Create an account</h1>
      <ActionForm action={signup} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label">I am a</legend>
          <label className="card flex cursor-pointer items-center gap-2 p-3 font-mono text-sm has-[:checked]:shadow-[5px_5px_0_var(--accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
            <input type="radio" name="role" value="LISTENER" defaultChecked className="accent-[var(--accent)]" /> listener
          </label>
          <label className="card flex cursor-pointer items-center gap-2 p-3 font-mono text-sm has-[:checked]:shadow-[5px_5px_0_var(--accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
            <input type="radio" name="role" value="ARTIST" className="accent-[var(--accent)]" /> artist
          </label>
        </fieldset>
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
  );
}
