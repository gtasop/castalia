import { canView } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serveFile } from "@/lib/http";
import { ensurePreview } from "@/lib/previews";
import { isId } from "@/lib/ids";

/** The album's 15-second preview, for anyone logged in (published albums) and the artist. */
export async function GET(req: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  if (!isId(albumId)) return new Response("Not found", { status: 404 });
  const album = await db.album.findUnique({
    where: { id: albumId },
    include: { tracks: { select: { id: true, number: true, title: true, durationSec: true, status: true, files: { select: { quality: true, key: true, bytes: true } } } } },
  });
  if (!album) return new Response("Not found", { status: 404 });
  const user = await currentUser();
  if (!user) return new Response("Log in to hear previews", { status: 401 });
  if (!(await canView(user, album))) return new Response("Not found", { status: 404 });

  try {
    const clip = await ensurePreview(album);
    if (!clip) return new Response("This album has no tracks yet", { status: 404 });
    return serveFile(req, { key: clip.key, mime: "audio/mp4", bytes: clip.bytes });
  } catch (e) {
    console.error(`Preview for album ${albumId} failed`, e);
    return new Response("Could not prepare the preview", { status: 500 });
  }
}
