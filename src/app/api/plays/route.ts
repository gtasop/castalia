import { canStreamTrack } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { MIN_PLAY_SECONDS } from "@/lib/constants";
import { db } from "@/lib/db";
import { lock } from "@/lib/locks";

/**
 * Called by the player once a track has been listened to for 30 seconds.
 * Plays are listening statistics for artists (no money depends on them).
 *
 * A play counts only if:
 * - the track is ready and at least 30 seconds long (shorter tracks never
 *   earn from plays, as on other services),
 * - the listener can stream it and isn't its artist,
 * - the same track wasn't counted for this listener within its own length,
 * - and no other play was counted for this listener in the last 30 seconds,
 *   since nobody can listen to two things at once.
 * The checks and the insert run under a per-listener lock, so a burst of
 * parallel requests counts at most once.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => null);
  const trackId = typeof body?.trackId === "string" ? body.trackId : null;
  const listened = Number(body?.listenedSec);
  if (!trackId || !Number.isFinite(listened)) return new Response("Bad request", { status: 400 });

  const track = await db.track.findUnique({ where: { id: trackId }, include: { album: true } });
  if (!track || track.status !== "READY" || !(await canStreamTrack(user, track))) return new Response("Forbidden", { status: 403 });

  if (track.durationSec < MIN_PLAY_SECONDS) return Response.json({ counted: false, reason: "track shorter than 30 seconds" });
  if (listened < MIN_PLAY_SECONDS) return Response.json({ counted: false, reason: "too short" });
  if (user.artist?.id === track.album.artistId) return Response.json({ counted: false, reason: "own music" });

  const result = await db.$transaction(async (tx) => {
    await lock(tx, `plays:${user.id}`);
    const now = Date.now();
    const sameTrack = await tx.play.findFirst({
      where: { userId: user.id, trackId, playedAt: { gt: new Date(now - track.durationSec * 1000) } },
      select: { id: true },
    });
    if (sameTrack) return "duplicate";
    const anyRecent = await tx.play.findFirst({
      where: { userId: user.id, playedAt: { gt: new Date(now - MIN_PLAY_SECONDS * 1000) } },
      select: { id: true },
    });
    if (anyRecent) return "too soon after the last counted play";
    await tx.play.create({ data: { userId: user.id, trackId, artistId: track.album.artistId } });
    return null;
  });

  return result ? Response.json({ counted: false, reason: result }) : Response.json({ counted: true });
}
