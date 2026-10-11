import { db } from "@/lib/db";
import { serveFile } from "@/lib/http";
import { stat } from "node:fs/promises";
import path from "node:path";
import { usesSignedUrls } from "@/lib/storage";

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(req: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  const album = await db.album.findUnique({ where: { id: albumId }, select: { coverKey: true } });
  if (!album?.coverKey) return new Response("Not found", { status: 404 });
  const mime = MIME[path.extname(album.coverKey)] ?? "application/octet-stream";
  const bytes = usesSignedUrls() ? 0 : (await stat(path.resolve("storage", album.coverKey))).size;
  return serveFile(req, { key: album.coverKey, mime, bytes });
}
