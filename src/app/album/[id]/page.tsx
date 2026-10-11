import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackList, type PlayerTrack } from "@/components/player";
import { Cover, Notice } from "@/components/ui";
import { canStream, ownsAlbum } from "@/lib/access";
import { currentUser, hasActiveSubscription } from "@/lib/auth";
import { DOWNLOAD_FORMATS } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatEur, simulatedCardFee, vatIncluded } from "@/lib/money";
import { buyAlbum } from "../../actions";

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bought?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  const album = await db.album.findUnique({
    where: { id },
    include: { artist: true, tracks: { where: { status: "READY" }, orderBy: { number: "asc" }, include: { files: true } } },
  });
  if (!album || (!album.published && user?.artist?.id !== album.artistId)) notFound();

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
        <Notice error={sp.error} success={sp.bought ? "Thank you! The album is yours: stream it here or download the files below." : undefined} />
        <p className="text-sm text-muted">{hasHiRes ? "Hi-Res lossless" : "Lossless"} album</p>
        <h1 className="h1">{album.title}</h1>
        <Link href={`/artist/${album.artist.id}`} className="link">
          {album.artist.name}
        </Link>
        {album.description && <p className="mt-3 max-w-prose text-muted">{album.description}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {owned ? (
            <span className="text-sm text-muted">{user?.artist?.id === album.artistId ? "Your album" : "You own this album"}</span>
          ) : (
            <form action={buyAlbum}>
              <input type="hidden" name="albumId" value={album.id} />
              <button className="btn">Buy album · {formatEur(album.priceCents)}</button>
            </form>
          )}
          {!playable && !hasActiveSubscription(user) && (
            <Link href={user ? "/subscribe" : "/signup"} className="btn-ghost">
              Or subscribe to stream
            </Link>
          )}
        </div>
        {!owned && (
          <p className="mt-2 text-xs text-muted">
            {formatEur(toArtist)} goes to {album.artist.name}. The rest is VAT ({formatEur(vat)}) and the card fee (about {formatEur(fee)}).
          </p>
        )}

        <div className="mt-8">
          {album.tracks.length === 0 ? <p className="text-muted">No tracks yet.</p> : <TrackList tracks={tracks} canPlay={playable} />}
        </div>

        {owned && album.tracks.length > 0 && (
          <div className="card mt-8">
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
                  <li key={t.id} className="flex flex-wrap gap-x-3">
                    <span className="flex-1">
                      {t.number}. {t.title}
                    </span>
                    {(Object.keys(DOWNLOAD_FORMATS) as (keyof typeof DOWNLOAD_FORMATS)[])
                      .filter((f) => f !== "hires" || t.files.some((x) => x.quality === "HIRES"))
                      .map((f) => (
                        <a key={f} className="link" href={`/api/download/track/${t.id}?format=${f}`}>
                          {DOWNLOAD_FORMATS[f].label}
                        </a>
                      ))}
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
