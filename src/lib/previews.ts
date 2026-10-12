import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { db } from "./db";
import { deleteFile, putFile, readFile } from "./storage";

// Every album has a 15-second preview anyone can hear, even without an
// account. It is a separate short clip, so the full track is never exposed,
// and it never counts as a play. The artist picks the track and start; if
// they have not, the first track is used from 30 seconds in.

export const PREVIEW_SECONDS = 15;
const DEFAULT_START_SEC = 30;
const run = promisify(execFile);

type AlbumForPreview = {
  id: string;
  previewTrackId: string | null;
  previewStartSec: number;
  previewKey: string | null;
  previewFingerprint: string | null;
  tracks: { id: string; number: number; title: string; durationSec: number; status: string; files: { quality: string; key: string; bytes: number }[] }[];
};

/** The latest a clip can start so it still has 15 seconds of audio. */
export function latestStart(durationSec: number) {
  return Math.max(0, Math.floor(durationSec - PREVIEW_SECONDS));
}

/** Which track and start the preview uses, after falling back and clamping. */
export function resolvePreview(album: AlbumForPreview) {
  const ready = album.tracks.filter((t) => t.status === "READY" && t.files.some((f) => f.quality === "LOSSLESS")).sort((a, b) => a.number - b.number);
  const chosen = ready.find((t) => t.id === album.previewTrackId);
  const track = chosen ?? ready[0];
  if (!track) return null;
  const wanted = chosen ? album.previewStartSec : DEFAULT_START_SEC;
  const startSec = Math.min(Math.max(0, wanted), latestStart(track.durationSec));
  const source = track.files.find((f) => f.quality === "LOSSLESS")!;
  const fingerprint = createHash("sha256").update(`${track.id}:${startSec}:${source.key}:${source.bytes}`).digest("hex").slice(0, 16);
  return { track, startSec, source, fingerprint, chosenByArtist: !!chosen };
}

const generating = new Map<string, Promise<{ key: string; bytes: number }>>();

/** Returns the stored clip for the album's current choice, cutting it if needed. */
export async function ensurePreview(album: AlbumForPreview) {
  const plan = resolvePreview(album);
  if (!plan) return null;
  if (album.previewKey && album.previewFingerprint === plan.fingerprint) {
    const bytes = await storedSize(album.previewKey);
    if (bytes !== null) return { key: album.previewKey, bytes };
  }
  const id = `${album.id}:${plan.fingerprint}`;
  let job = generating.get(id);
  if (!job) {
    job = cutPreview(album, plan).finally(() => generating.delete(id));
    generating.set(id, job);
  }
  return job;
}

async function cutPreview(album: AlbumForPreview, plan: NonNullable<ReturnType<typeof resolvePreview>>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "castalia-preview-"));
  try {
    const src = path.join(dir, "source.flac");
    await pipeline(await readFile(plan.source.key), createWriteStream(src));
    const length = Math.min(PREVIEW_SECONDS, plan.track.durationSec - plan.startSec);
    const out = path.join(dir, "preview.m4a");
    await run(ffmpegPath as string, [
      "-y", "-v", "error",
      "-ss", String(plan.startSec), "-t", String(length), "-protocol_whitelist", "file", "-f", "flac", "-i", src,
      "-map", "0:a:0", "-map_metadata", "-1",
      "-af", `afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, length - 1.5)}:d=1.5`,
      "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart",
      out,
    ]);
    const key = `previews/${album.id}/${plan.fingerprint}.m4a`;
    await putFile(key, out, "audio/mp4");
    const { size } = await stat(out);
    await db.album.update({ where: { id: album.id }, data: { previewKey: key, previewFingerprint: plan.fingerprint } });
    if (album.previewKey && album.previewKey !== key) await deleteFile(album.previewKey).catch(() => {});
    return { key, bytes: size };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function storedSize(key: string): Promise<number | null> {
  if (process.env.STORAGE_DRIVER === "s3") return 0; // served by redirect, size not needed
  try {
    return (await stat(path.resolve("storage", key))).size;
  } catch {
    return null;
  }
}

/** Changes whenever the artist's choice changes, for cache-busting URLs. */
export function previewVersion(album: { previewTrackId: string | null; previewStartSec: number }) {
  return `${album.previewTrackId ?? "auto"}-${album.previewStartSec}`;
}
