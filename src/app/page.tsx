import Link from "next/link";
import { CdArt } from "@/components/art";
import { AlbumCard } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const user = await currentUser();
  // Albums are for members: visitors see what Castalia is and how to join.
  const albums = user
    ? await db.album.findMany({
        where: { published: true, tracks: { some: { status: "READY" } } },
        include: { artist: { select: { id: true, name: true } } },
        orderBy: { releasedAt: "desc" },
      })
    : [];

  return (
    <div>
      <section className="mb-14 grid items-center gap-x-10 gap-y-8 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        <div>
          <h1 className="font-mono text-[1.75rem] leading-snug font-bold tracking-tighter sm:text-5xl md:text-4xl lg:text-5xl">
            <span className="sr-only">Fair to your ears. Fair to the artists.</span>
            {/* One "Fair" shared by both lines. */}
            <span aria-hidden="true" className="grid w-fit grid-cols-[auto_auto] items-center gap-x-3 sm:gap-x-4">
              <span className="row-span-2 flex -rotate-2 items-center self-stretch rounded-xl bg-accent px-3 text-accent-fg sm:px-4">Fair</span>
              <span>to your ears.</span>
              <span>to the artists.</span>
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Buy albums straight from the artists: you pay them directly, and Castalia takes nothing. With a free account, hear a
            preview of every album and the tracks artists open up, in lossless up to 24-bit / 192 kHz. Albums you buy are yours to
            stream and download.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            {user && (
              <Link href="/albums" className="btn">
                Browse albums
              </Link>
            )}
            <Link href="/transparency" className="btn-ghost">
              How it&apos;s fair
            </Link>
          </div>
        </div>
        <CdArt className="mx-auto w-full max-w-sm md:max-w-none" />
      </section>

      {user ? (
        <>
          <div className="mb-6 flex items-baseline justify-between gap-3 border-b-[1.5px] border-edge pb-2">
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
        </>
      ) : (
        <section className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="max-w-xl">
            <h2 className="h2">The albums are for members</h2>
            <p className="mt-1 text-sm text-muted">
              Create a free account to browse every album, hear previews and open tracks, and buy straight from the artists.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup?next=/albums" className="btn">
              Create a free account
            </Link>
            <Link href="/login?next=/albums" className="btn-ghost">
              Log in
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
