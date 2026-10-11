import Link from "next/link";
import { AlbumCard } from "@/components/ui";
import { currentUser, hasActiveSubscription } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const user = await currentUser();
  const albums = await db.album.findMany({
    where: { published: true },
    include: { artist: { select: { id: true, name: true } } },
    orderBy: { releasedAt: "desc" },
  });

  return (
    <div>
      <section className="mb-12 max-w-2xl">
        <h1 className="h1">Music where the artist gets the money.</h1>
        <p className="mt-3 text-muted">
          Your subscription pays the artists <em>you</em> listen to, after VAT, card fees and our hosting bill (never more than 20%). No
          profit, no ads, lossless audio up to 24-bit / 192 kHz. Or buy an album and keep the files.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!hasActiveSubscription(user) && (
            <Link href="/subscribe" className="btn">
              Subscribe from €5 / month
            </Link>
          )}
          <Link href="/transparency" className="btn-ghost">
            See where the money goes
          </Link>
        </div>
      </section>

      <h2 className="h2 mb-4">Albums</h2>
      {albums.length === 0 ? (
        <p className="text-muted">No albums published yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} />
          ))}
        </div>
      )}
    </div>
  );
}
