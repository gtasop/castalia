import { stat } from "node:fs/promises";
import path from "node:path";
import { canView } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serveFile } from "@/lib/http";
import { usesSignedUrls } from "@/lib/storage";
import { isId } from "@/lib/ids";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Album covers: anyone logged in for published albums, otherwise the artist and buyers only. */
export async function GET(req: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  if (!isId(albumId)) return new Response("Not found", { status: 404 });
  const album = await db.album.findUnique({ where: { id: albumId }, select: { coverKey: true, published: true, artistId: true, id: true } });
  if (!album?.coverKey) return new Response("Not found", { status: 404 });
  if (!(await canView(await currentUser(), album))) return new Response("Not found", { status: 404 });
  const mime = MIME[path.extname(album.coverKey)] ?? "application/octet-stream";
  const bytes = usesSignedUrls() ? 0 : (await stat(path.resolve("storage", album.coverKey))).size;
  return serveFile(req, { key: album.coverKey, mime, bytes });
}
