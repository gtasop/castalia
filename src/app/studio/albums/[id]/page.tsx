import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PreviewButton } from "@/components/preview";
import { Cover, Notice } from "@/components/ui";
import { CoverUploader, RefreshWhileProcessing, TrackUploader } from "@/components/uploader";
import { qualityLabel } from "@/lib/audio";
import { requireArtist } from "@/lib/auth";
import { MIN_PLAY_SECONDS } from "@/lib/constants";
import { db } from "@/lib/db";
import { verifiedError } from "@/lib/flash";
import { isId } from "@/lib/ids";
import { GENRES, MAX_GENRES } from "@/lib/genres";
import { PREVIEW_SECONDS, previewVersion, resolvePreview } from "@/lib/previews";
import { deleteTrack, renameTrack, setPreview, setPublished, updateAlbum, uploadCover } from "../../../actions";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const SAVED: Record<string, string> = { details: "Album details saved.", preview: "Preview saved." };

export const metadata = { title: "Edit album" };

export default async function EditAlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sig?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { artist } = await requireArtist(`/studio/albums/${id}`);
  if (!isId(id)) notFound();
  const album = await db.album.findUnique({
    where: { id },
    include: { tracks: { orderBy: { number: "asc" }, include: { files: { orderBy: { quality: "asc" } } } } },
  });
  if (!album || album.artistId !== artist.id) notFound();
  const processing = album.tracks.some((t) => t.status === "PROCESSING");
  const readyTracks = album.tracks.filter((t) => t.status === "READY");
  const preview = resolvePreview(album);

  return (
    <div className="space-y-8">
      <RefreshWhileProcessing active={processing} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/studio" className="text-sm text-muted hover:text-fg">← Studio</Link>
          <h1 className="h1 [overflow-wrap:anywhere]">{album.title}</h1>
          {!album.published && <p className="mt-1 font-mono text-xs text-muted">draft: only you can see this album</p>}
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
      <Notice error={verifiedError(sp)} success={sp.saved ? SAVED[sp.saved] : undefined} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <div className="shadow-[5px_5px_0_var(--fg)]">
            <Cover albumId={album.id} coverKey={album.coverKey} title={album.title} />
          </div>
          <CoverUploader albumId={album.id} action={uploadCover} />
        </div>

        <ActionForm key={`${album.title}|${album.description}|${album.priceCents}|${album.genres.join()}`} action={updateAlbum} className="card space-y-3">
          <input type="hidden" name="albumId" value={album.id} />
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input className="input" id="title" name="title" defaultValue={album.title} maxLength={200} required />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea className="input" id="description" name="description" rows={3} defaultValue={album.description} maxLength={2000} />
          </div>
          <div className="max-w-40">
            <label className="label" htmlFor="price">Price (EUR, VAT incl.)</label>
            <input className="input" id="price" name="price" inputMode="decimal" defaultValue={(album.priceCents / 100).toFixed(2)} required />
          </div>
          <fieldset>
            <legend className="label">Genres (optional, up to {MAX_GENRES})</legend>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <label
                  key={g}
                  className="cursor-pointer border-2 border-fg px-2 py-0.5 font-mono text-xs has-[:checked]:bg-accent has-[:checked]:text-accent-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                >
                  <input type="checkbox" name="genres" value={g} defaultChecked={album.genres.includes(g)} className="sr-only" />
                  {g.toLowerCase()}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-ghost">Save</button>
        </ActionForm>
      </div>

      <section className="card">
        <h2 className="h2">Preview</h2>
        <p className="mt-1 text-sm text-muted">
          {PREVIEW_SECONDS} seconds anyone can hear before buying, even without an account. Previews never count as plays.
        </p>
        {preview ? (
          <>
            {/* Keyed so the fields reset to the saved choice after each save. */}
            <ActionForm key={previewVersion(album)} action={setPreview} className="mt-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="albumId" value={album.id} />
              <div className="min-w-56 flex-1">
                <label className="label" htmlFor="trackId">Track</label>
                <select className="input" id="trackId" name="trackId" defaultValue={preview.chosenByArtist ? preview.track.id : ""}>
                  <option value="">Automatic: track 1, from 0:30</option>
                  {readyTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.number}. {t.title} ({clock(t.durationSec)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="label" htmlFor="start">Starts at</label>
                <input className="input" id="start" name="start" placeholder="0:30" defaultValue={preview.chosenByArtist ? clock(preview.startSec) : ""} />
              </div>
              <button className="btn-ghost">Save preview</button>
              </div>
            </ActionForm>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <PreviewButton albumId={album.id} title={album.title} version={previewVersion(album)} />
              <span className="text-muted">
                Now playing from <strong className="text-fg">{preview.track.title}</strong>, {clock(preview.startSec)} to{" "}
                {clock(preview.startSec + Math.min(PREVIEW_SECONDS, preview.track.durationSec - preview.startSec))}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Add a track first. The preview is cut from one of your tracks.</p>
        )}
      </section>

      <section>
        <h2 className="h2">Tracks</h2>
        <ol className="mt-3 divide-y divide-line">
          {album.tracks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-6 text-right font-mono text-sm text-muted">{t.number}</span>
              <form action={renameTrack} className="flex min-w-48 flex-1 gap-2">
                <input type="hidden" name="albumId" value={album.id} />
                <input type="hidden" name="trackId" value={t.id} />
                <input className="input" name="title" defaultValue={t.title} maxLength={200} aria-label={`Title of track ${t.number}`} />
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
                {t.status === "READY" && t.durationSec < MIN_PLAY_SECONDS && " · under 30 s, plays don't count"}
              </span>
              {t.status !== "PROCESSING" && (
                <form action={deleteTrack}>
                  <input type="hidden" name="albumId" value={album.id} />
                  <input type="hidden" name="trackId" value={t.id} />
                  <button className="text-sm text-muted hover:text-danger" aria-label={`Delete track ${t.number}`}>
                    Delete
                  </button>
                </form>
              )}
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
