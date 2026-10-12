import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { after } from "next/server";
import { processTrack } from "@/lib/audio";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lock } from "@/lib/locks";
import { cleanLine } from "@/lib/text";

const ALLOWED = new Set([".flac", ".wav", ".aif", ".aiff", ".m4a", ".alac", ".wv", ".w64"]);
const MAX_BYTES = 2 * 1024 ** 3;

/** Artist uploads one lossless master; it is transcoded in the background. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.artist) return new Response("Unauthorized", { status: 401 });
  // Refuse oversized uploads before reading the body.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 1024 ** 2) {
    return new Response("File too large (max 2 GB)", { status: 413 });
  }

  const form = await req.formData();
  const albumId = String(form.get("albumId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("No file", { status: 400 });
  // The browser sends just the file name; split on the last dot only, so
  // names like "AC\DC.flac" or "Ünï.FLAC" keep their title intact.
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ALLOWED.has(ext)) return new Response("Upload a lossless file: FLAC, WAV, AIFF or ALAC", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("File too large (max 2 GB)", { status: 413 });
  if (file.size === 0) return new Response("The file is empty", { status: 400 });

  const album = await db.album.findUnique({ where: { id: albumId }, select: { id: true, artistId: true } });
  if (!album || album.artistId !== user.artist.id) return new Response("Not found", { status: 404 });

  const title = cleanLine(form.get("title"), 200) || cleanLine(file.name.slice(0, dot), 200) || "Untitled";
  // Number under a per-album lock so parallel uploads get 1, 2, 3, …
  const track = await db.$transaction(async (tx) => {
    await lock(tx, `album-tracks:${albumId}`);
    const last = await tx.track.aggregate({ where: { albumId }, _max: { number: true } });
    return tx.track.create({ data: { albumId, title, number: (last._max.number ?? 0) + 1 } });
  });

  const dir = await mkdtemp(path.join(os.tmpdir(), "castalia-up-"));
  const master = path.join(dir, `master${ext}`);
  await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(master));

  after(async () => {
    try {
      await processTrack(track.id, master);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  return Response.json({ trackId: track.id });
}
