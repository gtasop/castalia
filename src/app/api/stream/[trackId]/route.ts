import type { Quality } from "@prisma/client";
import { canStreamTrack } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serveFile } from "@/lib/http";
import { isId } from "@/lib/ids";

// Falls back to the next best quality when a format does not exist
// (e.g. no hi-res file for a CD-quality master).
const FALLBACK = {
  HIRES: ["HIRES", "LOSSLESS", "LOW"],
  LOSSLESS: ["LOSSLESS", "LOW"],
  LOW: ["LOW", "LOSSLESS"],
} satisfies Record<string, Quality[]>;

export async function GET(req: Request, { params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  if (!isId(trackId)) return new Response("Not found", { status: 404 });
  const user = await currentUser();
  const track = await db.track.findUnique({ where: { id: trackId }, include: { album: true, files: true } });
  if (!track || track.status !== "READY") return new Response("Not found", { status: 404 });
  if (!(await canStreamTrack(user, track))) return new Response("Buy the album to hear this track in full", { status: 403 });

  const wanted = new URL(req.url).searchParams.get("q") ?? "LOSSLESS";
  const order = Object.hasOwn(FALLBACK, wanted) ? FALLBACK[wanted as keyof typeof FALLBACK] : FALLBACK.LOSSLESS;
  for (const q of order) {
    const file = track.files.find((f) => f.quality === q);
    if (file) return serveFile(req, file);
  }
  return new Response("Not found", { status: 404 });
}
