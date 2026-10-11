import Link from "next/link";

export function Notice({ error, success }: { error?: string | string[]; success?: string }) {
  const msg = Array.isArray(error) ? error[0] : error;
  if (msg) return <p className="mb-6 rounded-lg border border-danger/40 px-4 py-3 text-sm text-danger">{msg}</p>;
  if (success) return <p className="mb-6 rounded-lg border border-accent/40 px-4 py-3 text-sm text-accent">{success}</p>;
  return null;
}

export function Cover({ albumId, coverKey, title, size = "full" }: { albumId: string; coverKey: string | null; title: string; size?: "full" | "sm" }) {
  const cls = size === "sm" ? "h-14 w-14 rounded-lg" : "aspect-square w-full rounded-xl";
  if (coverKey) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/cover/${albumId}?v=${encodeURIComponent(coverKey)}`} alt={`Cover of ${title}`} className={`${cls} object-cover`} />;
  }
  // A quiet generated cover based on the title, until the artist uploads one.
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div
      className={`${cls} flex items-end p-3`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 30% 45%), hsl(${(h + 40) % 360} 35% 25%))` }}
      aria-label={`Cover of ${title}`}
    >
      {size === "full" && <span className="text-sm font-medium text-white/90">{title}</span>}
    </div>
  );
}

export function AlbumCard({ album }: { album: { id: string; title: string; coverKey: string | null; artist: { id: string; name: string } } }) {
  return (
    <div>
      <Link href={`/album/${album.id}`} className="block transition hover:opacity-90">
        <Cover albumId={album.id} coverKey={album.coverKey} title={album.title} />
      </Link>
      <Link href={`/album/${album.id}`} className="mt-2 block truncate font-medium">
        {album.title}
      </Link>
      <Link href={`/artist/${album.artist.id}`} className="block truncate text-sm text-muted hover:text-fg">
        {album.artist.name}
      </Link>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
