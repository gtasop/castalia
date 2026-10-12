// Accent- and case-insensitive search. Album.searchText stores the title and
// artist name in this normalised form; queries are normalised the same way,
// so "cafe" finds "Café", "strasse" finds "Straße" and "ΚΑΣΤΑΛΙΑ" finds
// "Καστάλια".

export function searchKey(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ı/g, "i")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

export function albumSearchText(title: string, artistName: string) {
  return `${searchKey(title)} ${searchKey(artistName)}`;
}

/** Escape LIKE wildcards so "%" and "_" in a query match literally. */
export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
