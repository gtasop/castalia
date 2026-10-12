import "server-only";
import { hasActiveSubscription, type CurrentUser } from "./auth";
import { db } from "./db";

type AlbumRef = { id: string; published: boolean; artistId: string };

export async function ownsAlbum(user: CurrentUser | null, albumId: string): Promise<boolean> {
  if (!user) return false;
  const album = await db.album.findUnique({ where: { id: albumId }, select: { artistId: true } });
  if (!album) return false;
  if (user.artist?.id === album.artistId) return true;
  return !!(await db.purchase.findUnique({ where: { userId_albumId: { userId: user.id, albumId } }, select: { id: true } }));
}

/**
 * The artist and buyers can always stream (an album someone bought stays
 * theirs even if the artist unpublishes it); subscribers stream what is
 * published.
 */
export async function canStream(user: CurrentUser | null, album: AlbumRef) {
  if (!user) return false;
  if (user.artist?.id === album.artistId) return true;
  if (album.published && hasActiveSubscription(user)) return true;
  return ownsAlbum(user, album.id);
}

/** Who may see an album's page and cover: everyone if published, else its artist and buyers. */
export async function canView(user: CurrentUser | null, album: AlbumRef) {
  if (album.published) return true;
  if (!user) return false;
  return user.artist?.id === album.artistId || ownsAlbum(user, album.id);
}
