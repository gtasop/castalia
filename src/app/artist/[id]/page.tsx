import { notFound } from "next/navigation";
import { AlbumCard } from "@/components/ui";
import { db } from "@/lib/db";

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const artist = await db.artist.findUnique({
    where: { id },
    include: { albums: { where: { published: true }, orderBy: { releasedAt: "desc" } } },
  });
  if (!artist) notFound();

  return (
    <div>
      <h1 className="h1">{artist.name}</h1>
      {artist.bio && <p className="mt-3 max-w-prose text-muted">{artist.bio}</p>}
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {artist.albums.map((a) => (
          <AlbumCard key={a.id} album={{ ...a, artist: { id: artist.id, name: artist.name } }} />
        ))}
      </div>
    </div>
  );
}
