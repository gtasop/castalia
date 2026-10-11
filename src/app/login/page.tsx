import Link from "next/link";
import { Notice } from "@/components/ui";
import { login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-6">Log in</h1>
      <Notice error={error} />
      <form action={login} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">Log in</button>
      </form>
      <p className="mt-6 text-sm text-muted">
        New here? <Link href="/signup" className="link">Create an account</Link>
      </p>
    </div>
  );
}
