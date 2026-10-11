import type { Quality } from "@prisma/client";
import { canStream } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serveFile } from "@/lib/http";

// Falls back to the next best quality when a format does not exist
// (e.g. no hi-res file for a CD-quality master).
const FALLBACK: Record<string, Quality[]> = {
  HIRES: ["HIRES", "LOSSLESS", "LOW"],
  LOSSLESS: ["LOSSLESS", "LOW"],
  LOW: ["LOW", "LOSSLESS"],
};

export async function GET(req: Request, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const user = await currentUser();
  const track = await db.track.findUnique({ where: { id: trackId }, include: { album: true, files: true } });
  if (!track || track.status !== "READY") return new Response("Not found", { status: 404 });
  if (!(await canStream(user, track.album))) return new Response("Subscribe or buy this album to listen", { status: 403 });

  const wanted = new URL(req.url).searchParams.get("q") ?? "LOSSLESS";
  for (const q of FALLBACK[wanted] ?? FALLBACK.LOSSLESS) {
    const file = track.files.find((f) => f.quality === q);
    if (file) return serveFile(req, file);
  }
  return new Response("Not found", { status: 404 });
}
