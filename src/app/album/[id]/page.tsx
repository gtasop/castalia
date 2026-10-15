import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackList, type PlayerTrack } from "@/components/player";
import { PreviewButton } from "@/components/preview";
import { Cover, Notice } from "@/components/ui";
import { canView, ownsAlbum } from "@/lib/access";
import { currentUser, requireUser } from "@/lib/auth";
import { DOWNLOAD_FORMATS } from "@/lib/constants";
import { db } from "@/lib/db";
import { verifiedError } from "@/lib/flash";
import { isId } from "@/lib/ids";
import { genreSlug } from "@/lib/genres";
import { formatEur } from "@/lib/money";
import { canSell, confirmCheckout } from "@/lib/payments";
import { previewVersion } from "@/lib/previews";
import { buyAlbum } from "../../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) return { title: "Album not found" };
  if (!(await currentUser())) return { title: "Log in" };
  const album = await db.album.findUnique({ where: { id }, select: { title: true, published: true, artist: { select: { name: true } } } });
  return { title: album?.published ? `${album.title} by ${album.artist.name}` : "Album" };
}

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bought?: string; owned?: string; session?: string; error?: string; sig?: string }>;
}) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const sp = await searchParams;
  // Albums are for members; logging in brings them back here.
  const user = await requireUser(`/album/${id}`);
  // Back from Stripe Checkout: record the purchase now if the webhook hasn't yet.
  if (sp.bought && sp.session && user) await confirmCheckout(sp.session, id, user.id);
  const album = await db.album.findUnique({
    where: { id },
    include: { artist: true, tracks: { where: { status: "READY" }, orderBy: { number: "asc" }, include: { files: true } } },
  });
  // Unpublished albums stay visible to their artist and to everyone who bought them.
  if (!album || !(await canView(user, album))) notFound();
  const isArtist = user?.artist?.id === album.artistId;

  // Buyers and the artist hear everything; everyone else the open tracks.
  const owned = await ownsAlbum(user, album.id);
  const openCount = album.tracks.filter((t) => t.open).length;
  const forSale = album.published && album.tracks.length > 0 && canSell(album.artist);
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
      playable: owned || (t.open && album.published),
      open: t.open,
    };
  });

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <div className="self-start rounded-xl shadow-[4px_4px_0_var(--shadow)]">
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
              <Link key={g} href={`/albums?genre=${genreSlug(g)}`} className="chip hover:border-accent hover:bg-accent hover:text-accent-fg">
                {g.toLowerCase()}
              </Link>
            ))}
          </p>
        )}
        {album.description && <p className="mt-3 max-w-prose whitespace-pre-line text-muted [overflow-wrap:anywhere]">{album.description}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {owned ? (
            <span className="text-sm text-muted">{isArtist ? "Your album" : "You own this album"}</span>
          ) : forSale ? (
            <form id="buy" action={buyAlbum}>
              <input type="hidden" name="albumId" value={album.id} />
              <button className="btn">Buy album · {formatEur(album.priceCents)}</button>
            </form>
          ) : album.published && album.tracks.length > 0 ? (
            <span className="text-sm text-muted">Not for sale yet: the artist hasn&apos;t set up payments.</span>
          ) : null}
          {!owned && album.published && album.tracks.length > 0 && <PreviewButton albumId={album.id} title={album.title} version={previewVersion(album)} />}
        </div>
        {!owned && forSale && (
          <div className="mt-3 max-w-prose space-y-2 text-xs text-muted">
            {/* EU consumers can cancel online purchases within 14 days, unless they ask for digital
                content straight away and accept losing that right; asked here, checked again on the server. */}
            <label className="flex items-start gap-2 text-fg">
              <input form="buy" type="checkbox" name="waiver" value="1" required className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" />
              <span>
                I want the album straight away, and understand that I lose my 14-day right to cancel once the purchase is complete. I
                accept the{" "}
                <Link href="/terms" target="_blank" className="link">
                  Terms
                </Link>
                .
              </span>
            </label>
            <p>
              You buy from {album.artist.name} and pay them directly. Castalia takes nothing; only the card fee comes off.
            </p>
          </div>
        )}

        <div className="mt-8">
          {album.tracks.length === 0 ? (
            <p className="text-muted">No tracks yet.</p>
          ) : (
            <>
              {!owned && (
                <p className="mb-3 text-sm text-muted">
                  {openCount === 0
                    ? "Play the preview, or buy the album to hear every track in full."
                    : openCount === album.tracks.length
                      ? "Every track is open: listen in full for free."
                      : `${openCount} of ${album.tracks.length} tracks are open to everyone. Buy the album to hear the rest.`}
                </p>
              )}
              <TrackList tracks={tracks} />
            </>
          )}
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

        {!isArtist && (
          <p className="mt-10 font-mono text-xs">
            <Link href={`/report?album=${album.id}`} className="text-muted underline-offset-4 hover:text-fg hover:underline">
              report this album
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
