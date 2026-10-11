import Link from "next/link";
import { Notice } from "@/components/ui";
import { signup } from "../actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="h1 mb-6">Create an account</h1>
      <Notice error={error} />
      <form action={signup} className="space-y-4">
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label">I am a</legend>
          <label className="card flex cursor-pointer items-center gap-2 p-3 has-[:checked]:border-accent">
            <input type="radio" name="role" value="LISTENER" defaultChecked /> Listener
          </label>
          <label className="card flex cursor-pointer items-center gap-2 p-3 has-[:checked]:border-accent">
            <input type="radio" name="role" value="ARTIST" /> Artist
          </label>
        </fieldset>
        <div>
          <label className="label" htmlFor="name">Name (artists: your artist name)</label>
          <input className="input" id="name" name="name" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password (8+ characters)</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <button className="btn w-full">Create account</button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account? <Link href="/login" className="link">Log in</Link>
      </p>
    </div>
  );
}
