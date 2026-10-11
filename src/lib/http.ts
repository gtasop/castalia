import { Readable } from "node:stream";
import { readFile, signedUrl, usesSignedUrls } from "./storage";

/** Serves a stored file with HTTP range support (needed for seeking audio). */
export async function serveFile(
  req: Request,
  file: { key: string; mime: string; bytes: number },
  opts: { downloadName?: string } = {},
): Promise<Response> {
  if (usesSignedUrls()) {
    const url = await signedUrl(file.key, opts.downloadName);
    return Response.redirect(url!, 302);
  }
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (opts.downloadName) headers["Content-Disposition"] = `attachment; filename="${opts.downloadName.replace(/"/g, "")}"`;

  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : file.bytes - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : file.bytes - 1;
    start = Math.max(0, start);
    end = Math.min(end, file.bytes - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.bytes}` } });
    }
    const body = Readable.toWeb(await readFile(file.key, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${file.bytes}`, "Content-Length": String(end - start + 1) },
    });
  }
  const body = Readable.toWeb(await readFile(file.key)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(file.bytes) } });
}

export function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "track";
}
