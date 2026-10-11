import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import { ownsAlbum } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { downloadFormat } from "@/lib/constants";
import { db } from "@/lib/db";
import { safeFileName } from "@/lib/http";
import { readFile } from "@/lib/storage";

/** The whole album as a zip, DRM-free. */
export async function GET(req: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const user = await currentUser();
  if (!(await ownsAlbum(user, albumId))) return new Response("Buy the album to download it", { status: 403 });
  const album = await db.album.findUnique({
    where: { id: albumId },
    include: { artist: true, tracks: { where: { status: "READY" }, orderBy: { number: "asc" }, include: { files: true } } },
  });
  if (!album) return new Response("Not found", { status: 404 });

  const fmtKey = new URL(req.url).searchParams.get("format") ?? "flac";
  const fmt = downloadFormat(fmtKey);
  const folder = `${safeFileName(album.artist.name)} - ${safeFileName(album.title)}`;

  // Audio is already compressed, so the zip only stores it.
  const zip = archiver("zip", { store: true });
  const out = new PassThrough();
  zip.pipe(out);
  (async () => {
    for (const t of album.tracks) {
      const file = fmt.quality.map((q) => t.files.find((f) => f.quality === q)).find(Boolean);
      if (!file) continue;
      zip.append(await readFile(file.key), { name: `${folder}/${String(t.number).padStart(2, "0")} ${safeFileName(t.title)}.${fmt.ext}` });
    }
    await zip.finalize();
  })().catch((e) => out.destroy(e));

  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder} (${fmtKey.toUpperCase()}).zip"`,
    },
  });
}
