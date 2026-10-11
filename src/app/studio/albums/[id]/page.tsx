import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover, Notice } from "@/components/ui";
import { CoverUploader, RefreshWhileProcessing, TrackUploader } from "@/components/uploader";
import { qualityLabel } from "@/lib/audio";
import { requireArtist } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteTrack, renameTrack, setPublished, updateAlbum, uploadCover } from "../../../actions";

export default async function EditAlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { artist } = await requireArtist();
  const album = await db.album.findUnique({
    where: { id },
    include: { tracks: { orderBy: { number: "asc" }, include: { files: { orderBy: { quality: "asc" } } } } },
  });
  if (!album || album.artistId !== artist.id) notFound();
  const processing = album.tracks.some((t) => t.status === "PROCESSING");

  return (
    <div className="space-y-8">
      <RefreshWhileProcessing active={processing} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/studio" className="text-sm text-muted hover:text-fg">← Studio</Link>
          <h1 className="h1">{album.title}</h1>
        </div>
        <div className="flex gap-2">
          {album.published && (
            <Link href={`/album/${album.id}`} className="btn-ghost">View</Link>
          )}
          <form action={setPublished}>
            <input type="hidden" name="albumId" value={album.id} />
            <input type="hidden" name="publish" value={album.published ? "0" : "1"} />
            <button className={album.published ? "btn-ghost" : "btn"}>{album.published ? "Unpublish" : "Publish"}</button>
          </form>
        </div>
      </div>
      <Notice error={error} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <Cover albumId={album.id} coverKey={album.coverKey} title={album.title} />
          <CoverUploader albumId={album.id} action={uploadCover} />
        </div>

        <form action={updateAlbum} className="card space-y-3">
          <input type="hidden" name="albumId" value={album.id} />
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input className="input" id="title" name="title" defaultValue={album.title} required />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea className="input" id="description" name="description" rows={3} defaultValue={album.description} />
          </div>
          <div className="max-w-40">
            <label className="label" htmlFor="price">Price (EUR, VAT incl.)</label>
            <input className="input" id="price" name="price" inputMode="decimal" defaultValue={(album.priceCents / 100).toFixed(2)} required />
          </div>
          <button className="btn-ghost">Save</button>
        </form>
      </div>

      <section>
        <h2 className="h2">Tracks</h2>
        <ol className="mt-3 divide-y divide-line">
          {album.tracks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-6 text-right font-mono text-sm text-muted">{t.number}</span>
              <form action={renameTrack} className="flex min-w-48 flex-1 gap-2">
                <input type="hidden" name="albumId" value={album.id} />
                <input type="hidden" name="trackId" value={t.id} />
                <input className="input" name="title" defaultValue={t.title} aria-label="Track title" />
                <button className="btn-ghost">Rename</button>
              </form>
              <span className="text-xs text-muted">
                {t.status === "PROCESSING" && "Processing…"}
                {t.status === "FAILED" && <span className="text-danger">Failed: {t.error}</span>}
                {t.status === "READY" &&
                  t.files
                    .filter((f) => f.quality !== "MP3" && f.quality !== "LOW")
                    .map((f) => qualityLabel(f))
                    .join(" · ")}
              </span>
              <form action={deleteTrack}>
                <input type="hidden" name="albumId" value={album.id} />
                <input type="hidden" name="trackId" value={t.id} />
                <button className="text-sm text-muted hover:text-danger">Delete</button>
              </form>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <TrackUploader albumId={album.id} />
        </div>
      </section>
    </div>
  );
}
