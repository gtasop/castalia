import Link from "next/link";
import { Cover, Notice, Stat } from "@/components/ui";
import { requireArtist } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { createAlbum, updateArtistProfile } from "../actions";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { artist } = await requireArtist();
  const [albums, earned, paid, playsThisMonth] = await Promise.all([
    db.album.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { tracks: true } } } }),
    db.artistEarning.aggregate({ where: { artistId: artist.id }, _sum: { totalCents: true } }),
    db.artistEarning.aggregate({ where: { artistId: artist.id, paidAt: { not: null } }, _sum: { totalCents: true } }),
    db.play.count({ where: { artistId: artist.id, playedAt: { gte: new Date(new Date().setUTCDate(1)) } } }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="h1">Studio</h1>
        <p className="mt-1 text-muted">{artist.name}</p>
      </div>
      <Notice error={error} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Counted plays this month" value={String(playsThisMonth)} hint="Plays of 30 seconds or more" />
        <Stat label="Earned so far" value={formatEur(earned._sum.totalCents ?? 0)} hint="From closed months" />
        <Stat label="Paid out" value={formatEur(paid._sum.totalCents ?? 0)} hint={artist.payoutsEnabled ? "Payouts connected" : "Connect payouts to get paid"} />
      </section>
      <p className="-mt-6 text-sm">
        <Link href="/studio/payouts" className="link">Payouts and earnings →</Link>
      </p>

      <section>
        <h2 className="h2">Albums</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {albums.map((a) => (
            <Link key={a.id} href={`/studio/albums/${a.id}`} className="card flex items-center gap-4 p-3 transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--accent)]">
              <Cover albumId={a.id} coverKey={a.coverKey} title={a.title} size="sm" />
              <div className="min-w-0">
                <div className="truncate font-mono font-bold">{a.title}</div>
                <div className="text-sm text-muted">
                  {a._count.tracks} tracks · {formatEur(a.priceCents)} · {a.published ? "Published" : "Draft"}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <form action={createAlbum} className="card mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="title">New album title</label>
            <input className="input" id="title" name="title" required />
          </div>
          <div>
            <label className="label" htmlFor="price">Price (EUR)</label>
            <input className="input" id="price" name="price" inputMode="decimal" defaultValue="9.00" required />
          </div>
          <button className="btn">Create album</button>
        </form>
      </section>

      <section>
        <h2 className="h2">Profile</h2>
        <form action={updateArtistProfile} className="card mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="name">Artist name</label>
            <input className="input" id="name" name="name" defaultValue={artist.name} required />
          </div>
          <div>
            <label className="label" htmlFor="bio">Bio</label>
            <textarea className="input" id="bio" name="bio" rows={3} defaultValue={artist.bio} />
          </div>
          <button className="btn-ghost">Save profile</button>
        </form>
      </section>
    </div>
  );
}
