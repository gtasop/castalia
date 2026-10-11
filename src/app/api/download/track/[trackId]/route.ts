import { ownsAlbum } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { downloadFormat } from "@/lib/constants";
import { db } from "@/lib/db";
import { safeFileName, serveFile } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const user = await currentUser();
  const track = await db.track.findUnique({ where: { id: trackId }, include: { album: { include: { artist: true } }, files: true } });
  if (!track) return new Response("Not found", { status: 404 });
  if (!(await ownsAlbum(user, track.albumId))) return new Response("Buy the album to download it", { status: 403 });

  const fmt = downloadFormat(new URL(req.url).searchParams.get("format"));
  const file = fmt.quality.map((q) => track.files.find((f) => f.quality === q)).find(Boolean);
  if (!file) return new Response("Not found", { status: 404 });
  const name = `${String(track.number).padStart(2, "0")} ${safeFileName(track.album.artist.name)} - ${safeFileName(track.title)}.${fmt.ext}`;
  return serveFile(req, file, { downloadName: name });
}
