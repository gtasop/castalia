import { Readable } from "node:stream";
import { sliceChars } from "./text";
import { readFile, signedUrl, usesSignedUrls } from "./storage";

/** Serves a stored file with HTTP range support (needed for seeking audio). */
export async function serveFile(
  req: Request,
  file: { key: string; mime: string; bytes: number },
  opts: { downloadName?: string } = {},
): Promise<Response> {
  if (usesSignedUrls()) {
    const url = await signedUrl(file.key, opts.downloadName ? contentDisposition(opts.downloadName) : undefined);
    return Response.redirect(url!, 302);
  }
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (opts.downloadName) headers["Content-Disposition"] = contentDisposition(opts.downloadName);

  const range = parseRange(req.headers.get("range"), file.bytes);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.bytes}` } });
  }
  if (range) {
    const { start, end } = range;
    const body = Readable.toWeb(await readFile(file.key, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${file.bytes}`, "Content-Length": String(end - start + 1) },
    });
  }
  const body = Readable.toWeb(await readFile(file.key)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(file.bytes) } });
}

/**
 * A single byte range per RFC 9110: null means "ignore the header and send
 * the whole file" (absent, malformed, several ranges, or last < first),
 * "unsatisfiable" means 416.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : size - 1;
  if (m[2] && end < start) return null;
  if (start >= size) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Content-Disposition for a download name in any script: an ASCII fallback
 * for old clients plus the exact UTF-8 name (RFC 6266 / 5987). Header
 * values can only carry bytes up to 0xFF, so the raw name would fail.
 */
export function contentDisposition(name: string) {
  const ascii =
    name
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "")
      .replace(/_+/g, "_") || "download";
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

/** A file or folder name that is valid on Windows, macOS and Linux. */
export function safeFileName(s: string) {
  let name = s
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\u200D" || c === "\u200C" ? c : ""))
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  name = sliceChars(name, 120).trim();
  if (WINDOWS_RESERVED.test(name)) name = `_${name}`;
  return name || "track";
}
