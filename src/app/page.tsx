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
      <section className="mb-14 max-w-3xl">
        <h1 className="font-mono text-[1.75rem] leading-snug font-bold tracking-tighter sm:text-5xl">
          <span className="sr-only">Fair to your ears. Fair to the artists.</span>
          {/* One "Fair" shared by both lines. */}
          <span aria-hidden="true" className="grid w-fit grid-cols-[auto_auto] items-center gap-x-3 sm:gap-x-4">
            <span className="row-span-2 flex -rotate-2 items-center self-stretch bg-accent px-3 text-accent-fg sm:px-4">Fair</span>
            <span>to your ears.</span>
            <span>to the artists.</span>
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Your subscription pays the artists <em>you</em> listen to, after VAT, card fees and our hosting bill (never more than 20%). No
          profit, no ads, lossless audio up to 24-bit / 192 kHz. Or buy an album and keep the files.
        </p>
        <div className="mt-7 flex flex-wrap gap-4">
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

      <div className="mb-6 flex items-baseline justify-between gap-3 border-b-2 border-fg pb-2">
        <h2 className="h2">albums</h2>
        <Link href="/albums" className="link font-mono text-sm">
          browse and buy →
        </Link>
      </div>
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
