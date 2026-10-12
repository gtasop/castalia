/**
 * A same-site path to send someone to after logging in, or "/" if `next`
 * could lead anywhere else. Rejects control characters (browsers strip tabs
 * and newlines, which turns "/\t/evil.com" into "//evil.com") and anything
 * that resolves to another origin.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return "/";
  try {
    const base = "http://castalia.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
