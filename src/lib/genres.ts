// Shared by server and browser code. A fixed list keeps browsing filters
// consistent; artists pick up to MAX_GENRES of these per album.

export const GENRES = [
  "Ambient",
  "Blues",
  "Classical",
  "Country",
  "Electronic",
  "Experimental",
  "Folk",
  "Funk",
  "Hip-hop",
  "Jazz",
  "Latin",
  "Metal",
  "Pop",
  "Punk",
  "R&B and soul",
  "Reggae",
  "Rock",
  "Singer-songwriter",
  "Soundtrack",
  "World",
] as const;

export type Genre = (typeof GENRES)[number];

export const MAX_GENRES = 3;

export function isGenre(v: unknown): v is Genre {
  return typeof v === "string" && (GENRES as readonly string[]).includes(v);
}

/** URL-friendly form, e.g. "R&B and soul" -> "rb-and-soul". */
export function genreSlug(g: string) {
  return g.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function genreFromSlug(slug: string | undefined): Genre | null {
  return GENRES.find((g) => genreSlug(g) === slug) ?? null;
}
