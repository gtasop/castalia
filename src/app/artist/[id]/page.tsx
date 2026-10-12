import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/ui";
import { db } from "@/lib/db";
import { isId } from "@/lib/ids";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = isId(id) ? await db.artist.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: artist?.name ?? "Artist not found" };
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const artist = await db.artist.findUnique({
    where: { id },
    include: { albums: { where: { published: true, tracks: { some: { status: "READY" } } }, orderBy: { releasedAt: "desc" } } },
  });
  if (!artist) notFound();

  return (
    <div>
      <h1 className="h1 [overflow-wrap:anywhere]">{artist.name}</h1>
      {artist.bio && <p className="mt-3 max-w-prose whitespace-pre-line text-muted [overflow-wrap:anywhere]">{artist.bio}</p>}
      {artist.albums.length === 0 ? (
        <p className="mt-8 text-muted">No albums published yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {artist.albums.map((a) => (
            <AlbumCard key={a.id} album={{ ...a, artist: { id: artist.id, name: artist.name } }} />
          ))}
        </div>
      )}
    </div>
  );
}
