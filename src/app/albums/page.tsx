import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { PreviewButton } from "@/components/preview";
import { Cover } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { genreFromSlug, genreSlug } from "@/lib/genres";
import { formatEur } from "@/lib/money";
import { canSell } from "@/lib/payments";
import { previewVersion } from "@/lib/previews";
import { escapeLike, searchKey } from "@/lib/search";
import { cleanLine } from "@/lib/text";
import { buyAlbum } from "../actions";

export const metadata = { title: "Buy and download" };

const SORTS = {
  new: { label: "newest", orderBy: { releasedAt: "desc" } },
  price: { label: "price, low to high", orderBy: { priceCents: "asc" } },
  "price-desc": { label: "price, high to low", orderBy: { priceCents: "desc" } },
} satisfies Record<string, { label: string; orderBy: Prisma.AlbumOrderByWithRelationInput }>;
type Sort = keyof typeof SORTS;

type Search = { q?: string; genre?: string; hires?: string; sort?: string };
type RawSearch = { [K in keyof Search]?: string | string[] };

/** Repeated parameters (?q=a&q=b) arrive as arrays; use the first. */
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Link to this page with some filters changed, keeping the rest. */
function withParams(current: Search, change: Partial<Search>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...change })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/albums?${s}` : "/albums";
}

export default async function BrowseAlbumsPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const raw = await searchParams;
  const sp: Search = { q: first(raw.q), genre: first(raw.genre), hires: first(raw.hires), sort: first(raw.sort) };
  const user = await requireUser(withParams(sp, {}));
  const q = cleanLine(sp.q, 100);
  const key = searchKey(q);
  const genre = genreFromSlug(sp.genre);
  const hiresOnly = sp.hires === "1";
  const sort: Sort = sp.sort && Object.hasOwn(SORTS, sp.sort) ? (sp.sort as Sort) : "new";

  const where: Prisma.AlbumWhereInput = {
    published: true,
    AND: [
      { tracks: { some: { status: "READY" } } },
      // Accent- and case-insensitive; % and _ match literally.
      ...(key ? [{ searchText: { contains: escapeLike(key) } }] : []),
      ...(genre ? [{ genres: { has: genre } }] : []),
      ...(hiresOnly ? [{ tracks: { some: { files: { some: { quality: "HIRES" as const } } } } }] : []),
    ],
  };

  const [albums, genreCounts, owned] = await Promise.all([
    db.album.findMany({
      where,
      orderBy: SORTS[sort].orderBy,
      include: {
        artist: { select: { id: true, name: true, stripeAccountId: true, paymentsEnabled: true } },
        tracks: { where: { status: "READY" }, select: { open: true, files: { where: { quality: "HIRES" }, select: { id: true }, take: 1 } } },
      },
    }),
    db.$queryRaw<{ genre: string; count: bigint }[]>`
      SELECT g AS genre, COUNT(*) AS count FROM "Album", unnest(genres) AS g
      WHERE published AND EXISTS (SELECT 1 FROM "Track" t WHERE t."albumId" = "Album".id AND t.status = 'READY')
      GROUP BY g ORDER BY g`,
    user ? db.purchase.findMany({ where: { userId: user.id }, select: { albumId: true } }) : [],
  ]);
  const ownedIds = new Set(owned.map((p) => p.albumId));
  const filtered = !!(q || genre || hiresOnly);
  const chip = "chip";

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="h1">Buy and download</h1>
        <p className="mt-2 text-muted">
          Albums you buy are yours to keep: DRM-free FLAC (hi-res where the artist recorded it) and MP3, and streamable here for good.
          You pay the artist directly; Castalia takes nothing. Every album has a 15-second preview, and many have open tracks you can
          hear in full.
        </p>
      </div>

      <form action="/albums" className="card flex flex-wrap items-end gap-3 p-4">
        {genre && <input type="hidden" name="genre" value={genreSlug(genre)} />}
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input className="input" id="q" name="q" type="search" defaultValue={q} placeholder="album or artist" />
        </div>
        <div>
          <label className="label" htmlFor="sort">Sort</label>
          <select className="input" id="sort" name="sort" defaultValue={sort}>
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORTS[s].label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 py-2 font-mono text-sm">
          <input type="checkbox" name="hires" value="1" defaultChecked={hiresOnly} className="accent-[var(--accent)]" /> hi-res only
        </label>
        <button className="btn">Search</button>
      </form>

      {genreCounts.length > 0 && (
        <nav aria-label="Genres" className="flex flex-wrap gap-2">
          <Link href={withParams(sp, { genre: undefined })} aria-current={!genre ? "true" : undefined} className={`${chip} ${!genre ? "bg-fg text-bg" : "hover:bg-line"}`}>
            all genres
          </Link>
          {genreCounts.map((g) => (
            <Link
              key={g.genre}
              href={withParams(sp, { genre: genreSlug(g.genre) })}
              aria-current={genre === g.genre ? "true" : undefined}
              className={`${chip} ${genre === g.genre ? "bg-accent text-accent-fg" : "hover:bg-line"}`}
            >
              {g.genre.toLowerCase()} <span>· {Number(g.count)}</span>
            </Link>
          ))}
        </nav>
      )}

      <p className="font-mono text-sm text-muted">
        {albums.length} {albums.length === 1 ? "album" : "albums"}
        {filtered && (
          <>
            {" · "}
            <Link href="/albums" className="link">
              clear filters
            </Link>
          </>
        )}
      </p>

      {albums.length === 0 ? (
        <p className="text-muted">No albums match. Try another search or genre.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((a) => {
            const isOwner = user?.artist?.id === a.artistId;
            const isOwned = ownedIds.has(a.id) || isOwner;
            const hiRes = a.tracks.some((t) => t.files.length > 0);
            const openTracks = a.tracks.filter((t) => t.open).length;
            return (
              <article key={a.id} className="flex flex-col">
                <Link
                  href={`/album/${a.id}`}
                  className="block rounded-xl shadow-[3px_3px_0_var(--shadow)] transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--accent)]"
                >
                  <Cover albumId={a.id} coverKey={a.coverKey} title={a.title} />
                </Link>
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/album/${a.id}`} className="block truncate font-mono font-bold">
                      {a.title}
                    </Link>
                    <Link href={`/artist/${a.artist.id}`} className="block truncate text-sm text-muted hover:text-fg">
                      {a.artist.name}
                    </Link>
                  </div>
                  {hiRes && <span className="tag mt-1 shrink-0">hi-res</span>}
                </div>
                {a.genres.length > 0 && <p className="mt-1 truncate font-mono text-xs text-muted">{a.genres.map((g) => g.toLowerCase()).join(" / ")}</p>}
                {openTracks > 0 && (
                  <p className="mt-1 font-mono text-xs text-accent">
                    {openTracks === a.tracks.length ? "all tracks open" : `${openTracks} open ${openTracks === 1 ? "track" : "tracks"}`}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PreviewButton albumId={a.id} title={a.title} version={previewVersion(a)} small />
                  {isOwned ? (
                    <Link href={`/album/${a.id}#download`} className="btn px-2.5 py-1 text-xs">
                      {isOwner ? "your album" : "download"}
                    </Link>
                  ) : canSell(a.artist) ? (
                    <form action={buyAlbum}>
                      <input type="hidden" name="albumId" value={a.id} />
                      <button className="btn px-2.5 py-1 text-xs">buy · {formatEur(a.priceCents)}</button>
                    </form>
                  ) : (
                    <span className="font-mono text-xs text-muted">not for sale yet</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
