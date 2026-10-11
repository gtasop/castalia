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

const ALLOWED = new Set([".flac", ".wav", ".aif", ".aiff", ".m4a", ".alac"]);
const MAX_BYTES = 2 * 1024 ** 3;

/** Artist uploads one lossless master; it is transcoded in the background. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.artist) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const albumId = String(form.get("albumId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("No file", { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) return new Response("Upload a lossless file: FLAC, WAV, AIFF or ALAC", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("File too large (max 2 GB)", { status: 400 });

  const album = await db.album.findUnique({ where: { id: albumId }, include: { _count: { select: { tracks: true } } } });
  if (!album || album.artistId !== user.artist.id) return new Response("Not found", { status: 404 });

  const title = String(form.get("title") ?? "").trim() || path.basename(file.name, ext);
  const track = await db.track.create({ data: { albumId, title: title.slice(0, 200), number: album._count.tracks + 1 } });

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
