import archiver from "archiver";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DOWNLOAD_FORMATS, type DownloadFormat } from "./constants";
import { db } from "./db";
import { safeFileName } from "./http";
import { deleteFile, putFile, readFile } from "./storage";

// Album downloads are zips of the per-track files. Building one means
// reading every track through the app server, so each zip is built once,
// the first time a buyer asks for it, stored next to the tracks and then
// served straight from storage (on R2 that costs nothing to download).
// Zips are only built for albums that are actually downloaded, so albums
// nobody buys add no storage.

export function isDownloadFormat(v: string | null): v is DownloadFormat {
  return !!v && v in DOWNLOAD_FORMATS;
}

export async function loadAlbumForZip(albumId: string) {
  return db.album.findUnique({
    where: { id: albumId },
    include: { artist: true, tracks: { where: { status: "READY" }, orderBy: { number: "asc" }, include: { files: true } } },
  });
}

type AlbumForZip = NonNullable<Awaited<ReturnType<typeof loadAlbumForZip>>>;

/** What goes into the zip, and a fingerprint that changes whenever any of it does. */
export function zipPlan(album: AlbumForZip, format: DownloadFormat) {
  const fmt = DOWNLOAD_FORMATS[format];
  const folder = `${safeFileName(album.artist.name)} - ${safeFileName(album.title)}`;
  const entries = album.tracks.flatMap((t) => {
    const file = fmt.quality.map((q) => t.files.find((f) => f.quality === q)).find(Boolean);
    if (!file) return [];
    return [{ key: file.key, bytes: file.bytes, name: `${folder}/${String(t.number).padStart(2, "0")} ${safeFileName(t.title)}.${fmt.ext}` }];
  });
  const fingerprint = createHash("sha256").update(JSON.stringify([format, entries])).digest("hex");
  return { entries, fingerprint, downloadName: `${folder} (${format.toUpperCase()}).zip` };
}

// Builds in progress and recent failures, per album and format. In-process
// only: with several app servers the worst case is a zip built twice.
const building = new Map<string, Promise<void>>();
const failed = new Map<string, string>();

export type ZipState = { status: "building" } | { status: "failed"; error: string };

/** Starts building the zip in the background unless that is already happening. */
export function requestZip(album: AlbumForZip, format: DownloadFormat): ZipState {
  const id = `${album.id}:${format}`;
  const error = failed.get(id);
  if (error) {
    failed.delete(id); // the next request tries again
    return { status: "failed", error };
  }
  if (!building.has(id)) {
    const job = buildZip(album, format)
      .catch((e) => {
        console.error(`Building zip ${id} failed`, e);
        failed.set(id, e instanceof Error ? e.message : "Could not prepare the download");
      })
      .finally(() => building.delete(id));
    building.set(id, job);
  }
  return { status: "building" };
}

async function buildZip(album: AlbumForZip, format: DownloadFormat) {
  const { entries, fingerprint } = zipPlan(album, format);
  if (entries.length === 0) throw new Error("This album has no tracks to download yet");
  const dir = await mkdtemp(path.join(os.tmpdir(), "castalia-zip-"));
  try {
    const file = path.join(dir, "album.zip");
    const out = createWriteStream(file);
    // Audio is already compressed, so the zip only stores it.
    const zip = archiver("zip", { store: true });
    zip.pipe(out);
    // Add tracks one at a time so only one storage read is open at once.
    for (const e of entries) {
      const added = once(zip, "entry");
      zip.append(await readFile(e.key), { name: e.name });
      await added;
    }
    const closed = once(out, "close");
    await zip.finalize();
    await closed;

    const key = `zips/${album.id}/${format}-${fingerprint.slice(0, 16)}.zip`;
    await putFile(key, file, "application/zip");
    const { size } = await stat(file);
    const previous = await db.albumZip.findUnique({ where: { albumId_format: { albumId: album.id, format } } });
    await db.albumZip.upsert({
      where: { albumId_format: { albumId: album.id, format } },
      create: { albumId: album.id, format, fingerprint, key, bytes: BigInt(size) },
      update: { fingerprint, key, bytes: BigInt(size), createdAt: new Date() },
    });
    if (previous && previous.key !== key) await deleteFile(previous.key);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
