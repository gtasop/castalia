import "server-only";
import { hasActiveSubscription, type CurrentUser } from "./auth";
import { db } from "./db";

export async function ownsAlbum(user: CurrentUser | null, albumId: string): Promise<boolean> {
  if (!user) return false;
  const album = await db.album.findUnique({ where: { id: albumId }, select: { artistId: true } });
  if (!album) return false;
  if (user.artist?.id === album.artistId) return true;
  return !!(await db.purchase.findUnique({ where: { userId_albumId: { userId: user.id, albumId } }, select: { id: true } }));
}

/** Subscribers stream everything published; buyers and the artist stream their album. */
export async function canStream(user: CurrentUser | null, album: { id: string; published: boolean; artistId: string }) {
  if (!user) return false;
  if (user.artist?.id === album.artistId) return true;
  if (!album.published) return false;
  if (hasActiveSubscription(user)) return true;
  return ownsAlbum(user, album.id);
}
