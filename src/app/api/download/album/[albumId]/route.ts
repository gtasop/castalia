import { ownsAlbum } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serveFile } from "@/lib/http";
import { themePreference, type ThemePref } from "@/lib/theme";
import { isDownloadFormat } from "@/lib/constants";
import { loadAlbumForZip, requestZip, zipPlan } from "@/lib/zips";
import { isId } from "@/lib/ids";

/**
 * The whole album as a zip, DRM-free. Served from storage once it has been
 * built; the first request starts the build and shows a page that refreshes
 * until the zip is ready.
 */
export async function GET(req: Request, { params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  if (!isId(albumId)) return new Response("Not found", { status: 404 });
  const user = await currentUser();
  const album = await loadAlbumForZip(albumId);
  if (!album) return new Response("Not found", { status: 404 });
  if (!(await ownsAlbum(user, albumId))) return new Response("Buy the album to download it", { status: 403 });

  const requested = new URL(req.url).searchParams.get("format") ?? "flac";
  const format = isDownloadFormat(requested) ? requested : "flac";
  const { entries, fingerprint, downloadName } = zipPlan(album, format);
  if (entries.length === 0) return new Response("This album has no tracks to download yet", { status: 404 });

  const cached = await db.albumZip.findUnique({ where: { albumId_format: { albumId, format } } });
  if (cached && cached.fingerprint === fingerprint) {
    return serveFile(req, { key: cached.key, mime: "application/zip", bytes: Number(cached.bytes) }, { downloadName });
  }

  const state = requestZip(album, format);
  const theme = await themePreference(user);
  const back = `/album/${albumId}`;
  return state.status === "failed"
    ? page(theme, "Download failed", `<p>${escapeHtml(state.error)}</p><p><a href="?format=${format}">Try again</a> · <a href="${back}">Back to the album</a></p>`)
    : page(
        theme,
        "Preparing your download",
        `<p>We are putting <strong>${escapeHtml(album.title)}</strong> together. This happens once per album and format, and the download starts by itself when it is ready.</p><p><a href="${back}">Back to the album</a></p>`,
        3,
      );
}

function page(theme: ThemePref, title: string, body: string, refreshSeconds?: number) {
  const scheme = theme === "system" ? "light dark" : theme;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">` : ""}<title>${title} · Castalia</title>
<style>:root{color-scheme:${scheme}}body{font-family:ui-monospace,monospace;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.5}a{color:light-dark(#c2410c,#f97316)}</style>
</head><body><h1>${title}</h1>${body}</body></html>`;
  return new Response(html, {
    status: refreshSeconds ? 202 : 500,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
