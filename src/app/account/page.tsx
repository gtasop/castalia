import Link from "next/link";
import { GoogleMark } from "@/components/google-button";
import { ThemePicker } from "@/components/theme";
import { Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifiedError } from "@/lib/flash";
import { googleEnabled } from "@/lib/google";
import { formatEur } from "@/lib/money";
import { toThemePref } from "@/lib/theme";

export const metadata = { title: "Your account" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; sig?: string; google?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const purchases = await db.purchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { album: { include: { artist: true } } },
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="h1">Your account</h1>
        <div className="mt-4">
          <Notice error={verifiedError(sp)} success={sp.google === "connected" && user.googleId ? "Google connected. You can now log in with it." : undefined} />
        </div>
      </div>

      <section>
        <h2 className="h2">Your albums</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Albums you buy are yours to stream here and download, DRM-free. The money goes straight to the artist.{" "}
            <Link href="/albums" className="link">
              Browse albums
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {purchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
                <Link href={`/album/${p.albumId}`} className="link [overflow-wrap:anywhere]">
                  {p.album.title} <span className="text-muted">· {p.album.artist.name}</span>
                </Link>
                <span className="text-muted">
                  {formatEur(p.amountCents)} to {p.album.artist.name} · {dateFmt.format(p.createdAt)} ·{" "}
                  <Link href={`/album/${p.albumId}#download`} className="link">
                    download
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Signing in</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="[overflow-wrap:anywhere]">{user.email}</dd>
          <dt className="text-muted">Password</dt>
          <dd>{user.passwordHash ? "Set" : "None: you log in with Google"}</dd>
          <dt className="text-muted">Google</dt>
          <dd>{user.googleId ? "Connected" : "Not connected"}</dd>
        </dl>
        {!user.googleId && googleEnabled() && (
          <a href="/api/auth/google?link=1" className="btn-ghost mt-4 gap-3">
            <GoogleMark />
            Connect Google
          </a>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Appearance</h2>
        <p className="mt-1 text-sm text-muted">System follows your device&apos;s light or dark setting. Your choice is saved to your account.</p>
        <ThemePicker theme={toThemePref(user.theme)} />
      </section>
    </div>
  );
}
