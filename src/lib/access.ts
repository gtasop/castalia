import "server-only";
import type { CurrentUser } from "./auth";
import { db } from "./db";

// Who can see and hear what. Albums are for members: without an account
// nothing of an album is visible, not even its cover.
// - Open tracks of a published album: anyone logged in.
// - Every other track: the album's buyers and its artist. A purchase is
//   for keeps, so it still works if the artist later unpublishes.
// - Everyone else logged in gets the album's 15-second preview
//   (lib/previews.ts).

type AlbumRef = { id: string; published: boolean; artistId: string };

export async function ownsAlbum(user: CurrentUser | null, albumId: string): Promise<boolean> {
  if (!user) return false;
  const album = await db.album.findUnique({ where: { id: albumId }, select: { artistId: true } });
  if (!album) return false;
  if (user.artist?.id === album.artistId) return true;
  return !!(await db.purchase.findUnique({ where: { userId_albumId: { userId: user.id, albumId } }, select: { id: true } }));
}

/** Can this person stream the whole of `track`? */
export async function canStreamTrack(user: CurrentUser | null, track: { open: boolean; album: AlbumRef }) {
  if (!user) return false;
  if (track.open && track.album.published) return true;
  return ownsAlbum(user, track.album.id);
}

/** Who may see an album's page, cover and preview: anyone logged in if published, else its artist and buyers. */
export async function canView(user: CurrentUser | null, album: AlbumRef) {
  if (!user) return false;
  if (album.published) return true;
  return user.artist?.id === album.artistId || ownsAlbum(user, album.id);
}
