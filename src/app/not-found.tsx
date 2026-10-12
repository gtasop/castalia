import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="max-w-xl">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="h1 mt-1">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-muted">The link may be old, or the album may no longer be available.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/albums" className="btn">
          Browse albums
        </Link>
        <Link href="/" className="btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
