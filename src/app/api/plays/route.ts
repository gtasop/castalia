import { canStream } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { MIN_PLAY_SECONDS } from "@/lib/constants";
import { db } from "@/lib/db";

/**
 * Called by the player once a track has actually been listened to for 30
 * seconds (or to the end, for tracks shorter than that).
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => null);
  const trackId = typeof body?.trackId === "string" ? body.trackId : null;
  const listened = Number(body?.listenedSec);
  if (!trackId || !Number.isFinite(listened)) return new Response("Bad request", { status: 400 });

  const track = await db.track.findUnique({ where: { id: trackId }, include: { album: true } });
  if (!track || !(await canStream(user, track.album))) return new Response("Forbidden", { status: 403 });

  const needed = Math.min(MIN_PLAY_SECONDS, Math.floor(track.durationSec));
  if (listened < needed) return Response.json({ counted: false, reason: "too short" });
  // Artists listening to their own music do not earn from it.
  if (user.artist?.id === track.album.artistId) return Response.json({ counted: false, reason: "own music" });

  // At most one counted play per track per track-length window, so the
  // count cannot be inflated faster than the music can actually be played.
  const since = new Date(Date.now() - Math.max(needed, track.durationSec) * 1000);
  const recent = await db.play.findFirst({ where: { userId: user.id, trackId, playedAt: { gt: since } }, select: { id: true } });
  if (recent) return Response.json({ counted: false, reason: "duplicate" });

  await db.play.create({ data: { userId: user.id, trackId, artistId: track.album.artistId } });
  return Response.json({ counted: true });
}
