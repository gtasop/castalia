import Link from "next/link";
import { firstGrapheme } from "@/lib/text";

export function Notice({ error, success }: { error?: string | string[]; success?: string }) {
  const msg = Array.isArray(error) ? error[0] : error;
  if (msg) {
    return (
      <p className="mb-6 rounded-lg border-[1.5px] border-danger bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
        <span className="mr-2 font-mono font-bold">!</span>
        {msg}
      </p>
    );
  }
  if (success) {
    return (
      <p className="mb-6 rounded-lg border-[1.5px] border-edge bg-accent/5 px-4 py-3 text-sm" role="status">
        <span className="mr-2 font-mono font-bold text-accent">✓</span>
        {success}
      </p>
    );
  }
  return null;
}

// Placeholder covers until the artist uploads one: flat zine prints in the
// three brand colours, picked from the title so each album keeps its own.
const PRINTS = [
  { bg: "bg-accent", fg: "text-accent-fg" },
  { bg: "bg-fg", fg: "text-bg" },
  { bg: "bg-surface", fg: "text-fg" },
];

export function Cover({ albumId, coverKey, title, size = "full" }: { albumId: string; coverKey: string | null; title: string; size?: "full" | "sm" }) {
  const cls = size === "sm" ? "h-14 w-14 rounded-lg border-[1.5px]" : "aspect-square w-full rounded-xl border-[1.5px]";
  if (coverKey) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/cover/${albumId}?v=${encodeURIComponent(coverKey)}`} alt={`Cover of ${title}`} className={`${cls} border-edge object-cover`} />;
  }
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const print = PRINTS[h % PRINTS.length];
  // First real character (works for emoji, combining accents and RTL titles).
  const initial = firstGrapheme(title).toLocaleLowerCase() || "♪";
  return (
    <div className={`${cls} ${print.bg} ${print.fg} relative flex overflow-hidden border-edge font-mono font-bold`} role="img" aria-label={`Cover of ${title}`}>
      {size === "full" ? (
        <>
          <span className="absolute -bottom-[0.18em] left-2 text-[9rem] leading-none tracking-tighter">{initial}</span>
          <span className="absolute top-2 left-3 right-3 truncate text-xs">{title.toLowerCase()}</span>
        </>
      ) : (
        <span className="m-auto text-2xl">{initial}</span>
      )}
    </div>
  );
}

export function AlbumCard({ album }: { album: { id: string; title: string; coverKey: string | null; artist: { id: string; name: string } } }) {
  return (
    <div>
      <Link
        href={`/album/${album.id}`}
        className="block rounded-xl shadow-[3px_3px_0_var(--shadow)] transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--accent)]"
      >
        <Cover albumId={album.id} coverKey={album.coverKey} title={album.title} />
      </Link>
      <Link href={`/album/${album.id}`} className="mt-3 block truncate font-mono text-sm font-bold">
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
      <div className="font-mono text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-3xl font-bold tracking-tighter tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
