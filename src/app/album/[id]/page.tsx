import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackList, type PlayerTrack } from "@/components/player";
import { PreviewButton } from "@/components/preview";
import { Cover, Notice } from "@/components/ui";
import { canStream, canView, ownsAlbum } from "@/lib/access";
import { currentUser, hasActiveSubscription } from "@/lib/auth";
import { DOWNLOAD_FORMATS } from "@/lib/constants";
import { db } from "@/lib/db";
import { verifiedError } from "@/lib/flash";
import { isId } from "@/lib/ids";
import { genreSlug } from "@/lib/genres";
import { formatEur, simulatedCardFee, vatIncluded } from "@/lib/money";
import { previewVersion } from "@/lib/previews";
import { buyAlbum } from "../../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) return { title: "Album not found" };
  const album = await db.album.findUnique({ where: { id }, select: { title: true, published: true, artist: { select: { name: true } } } });
  return { title: album?.published ? `${album.title} by ${album.artist.name}` : "Album" };
}

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bought?: string; owned?: string; error?: string; sig?: string }>;
}) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const sp = await searchParams;
  const user = await currentUser();
  const album = await db.album.findUnique({
    where: { id },
    include: { artist: true, tracks: { where: { status: "READY" }, orderBy: { number: "asc" }, include: { files: true } } },
  });
  // Unpublished albums stay visible to their artist and to everyone who bought them.
  if (!album || !(await canView(user, album))) notFound();
  const isArtist = user?.artist?.id === album.artistId;

  const playable = await canStream(user, album);
  const owned = await ownsAlbum(user, album.id);
  const hasHiRes = album.tracks.some((t) => t.files.some((f) => f.quality === "HIRES"));

  const tracks: PlayerTrack[] = album.tracks.map((t) => {
    const hi = t.files.find((f) => f.quality === "HIRES");
    return {
      id: t.id,
      title: t.title,
      artist: album.artist.name,
      albumId: album.id,
      durationSec: t.durationSec,
      hiRes: hi ? `${hi.bitDepth}-bit / ${(hi.sampleRate ?? 0) / 1000} kHz` : null,
    };
  });

  // What the artist receives from one sale (estimate with the standard card fee).
  const vat = vatIncluded(album.priceCents);
  const fee = simulatedCardFee(album.priceCents);
  const toArtist = album.priceCents - vat - fee;

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <div className="self-start shadow-[6px_6px_0_var(--fg)]">
        <Cover albumId={album.id} coverKey={album.coverKey} title={album.title} />
      </div>
      <div>
        <Notice
          error={verifiedError(sp)}
          success={
            sp.bought
              ? "Thank you! The album is yours: stream it here or download the files below."
              : sp.owned
                ? "You already own this album, so there's nothing to pay. Stream it here or download it below."
                : undefined
          }
        />
        {!album.published && (
          <p className="mb-3 font-mono text-xs text-muted">
            {isArtist ? "draft: only you can see this album" : "no longer for sale, but it's yours to keep"}
          </p>
        )}
        <p className="text-sm text-muted">{hasHiRes ? "Hi-Res lossless" : "Lossless"} album</p>
        <h1 className="h1 [overflow-wrap:anywhere]">{album.title}</h1>
        <Link href={`/artist/${album.artist.id}`} className="link">
          {album.artist.name}
        </Link>
        {album.genres.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-2">
            {album.genres.map((g) => (
              <Link key={g} href={`/albums?genre=${genreSlug(g)}`} className="border-2 border-fg px-2 py-0.5 font-mono text-xs hover:bg-accent hover:text-accent-fg">
                {g.toLowerCase()}
              </Link>
            ))}
          </p>
        )}
        {album.description && <p className="mt-3 max-w-prose whitespace-pre-line text-muted [overflow-wrap:anywhere]">{album.description}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {owned ? (
            <span className="text-sm text-muted">{isArtist ? "Your album" : "You own this album"}</span>
          ) : album.published && album.tracks.length > 0 ? (
            <form action={buyAlbum}>
              <input type="hidden" name="albumId" value={album.id} />
              <button className="btn">Buy album · {formatEur(album.priceCents)}</button>
            </form>
          ) : null}
          {!playable && album.published && album.tracks.length > 0 && <PreviewButton albumId={album.id} title={album.title} version={previewVersion(album)} />}
          {!playable && !hasActiveSubscription(user) && (
            <Link href={user ? "/subscribe" : "/signup?next=%2Fsubscribe"} className="btn-ghost">
              Or subscribe to stream
            </Link>
          )}
        </div>
        {!owned && album.published && (
          <p className="mt-2 text-xs text-muted">
            {formatEur(toArtist)} goes to {album.artist.name}. The rest is VAT ({formatEur(vat)}) and the card fee (about {formatEur(fee)}).
          </p>
        )}

        <div className="mt-8">
          {album.tracks.length === 0 ? <p className="text-muted">No tracks yet.</p> : <TrackList tracks={tracks} canPlay={playable} />}
        </div>

        {owned && album.tracks.length > 0 && (
          <div id="download" className="card mt-8 scroll-mt-6">
            <h2 className="h2">Download, DRM-free</h2>
            <p className="mt-1 text-sm text-muted">Yours to keep, play anywhere and back up.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(DOWNLOAD_FORMATS) as (keyof typeof DOWNLOAD_FORMATS)[])
                .filter((f) => f !== "hires" || hasHiRes)
                .map((f) => (
                  <a key={f} className="btn-ghost" href={`/api/download/album/${album.id}?format=${f}`}>
                    Album · {DOWNLOAD_FORMATS[f].label} (.zip)
                  </a>
                ))}
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">Single tracks</summary>
              <ul className="mt-2 space-y-1">
                {album.tracks.map((t) => (
                  <li key={t.id} className="flex flex-col gap-x-3 border-b border-line py-1.5 sm:flex-row sm:flex-wrap">
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {t.number}. {t.title}
                    </span>
                    <span className="flex gap-3">
                    {(Object.keys(DOWNLOAD_FORMATS) as (keyof typeof DOWNLOAD_FORMATS)[])
                      .filter((f) => f !== "hires" || t.files.some((x) => x.quality === "HIRES"))
                      .map((f) => (
                        <a key={f} className="link" href={`/api/download/track/${t.id}?format=${f}`}>
                          {DOWNLOAD_FORMATS[f].label}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
