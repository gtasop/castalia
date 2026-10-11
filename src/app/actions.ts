"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, currentUser, destroySession, hashPassword, requireAdmin, requireArtist, requireUser, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { isGenre, MAX_GENRES } from "@/lib/genres";
import { MIN_ALBUM_CENTS, MIN_DONATION_CENTS, MIN_SUBSCRIPTION_CENTS, parseEuroInput } from "@/lib/money";
import {
  artistOnboardingUrl,
  cancelSubscription,
  demoEndPeriodsNow,
  resumeSubscription,
  startAlbumPurchase,
  startDonation,
  startSubscription,
} from "@/lib/payments";
import { createPayoutRun, deletePayoutRun, payRun } from "@/lib/payouts/run";
import { latestStart } from "@/lib/previews";
import { deletePrefix, putFile } from "@/lib/storage";
import { isTheme, setThemeCookie, themePreference, toThemeEnum, toThemePref } from "@/lib/theme";

const fail = (to: string, msg: string): never => redirect(`${to}${to.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`);

// ------------------------------------------------------------------ auth

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["LISTENER", "ARTIST"]),
});

export async function signup(form: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) fail("/signup", parsed.error!.issues[0].message);
  const { name, email, password, role } = parsed.data!;
  if (await db.user.findUnique({ where: { email } })) fail("/signup", "An account with this email already exists");
  const user = await db.user.create({
    data: {
      name,
      email,
      role,
      theme: toThemeEnum(await themePreference(null)),
      passwordHash: await hashPassword(password),
      ...(role === "ARTIST" ? { artist: { create: { name } } } : {}),
    },
  });
  await createSession(user.id);
  redirect(role === "ARTIST" ? "/studio" : "/subscribe");
}

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) fail(`/login?next=${encodeURIComponent(String(form.get("next") ?? ""))}`, "Wrong email or password");
  await createSession(user!.id);
  await setThemeCookie(toThemePref(user!.theme));
  const next = String(form.get("next") ?? "");
  // Only same-site paths, never "//host" or "/\host".
  redirect(/^\/(?![/\\])/.test(next) ? next : "/");
}

export async function setTheme(form: FormData) {
  const theme = form.get("theme");
  if (!isTheme(theme)) return;
  await setThemeCookie(theme);
  const user = await currentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { theme: toThemeEnum(theme) } });
  revalidatePath("/", "layout");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------------------------------------------------------- listener money

export async function subscribe(form: FormData) {
  const user = await requireUser();
  const cents = parseEuroInput(form.get("amount"));
  if (!cents || cents < MIN_SUBSCRIPTION_CENTS) fail("/subscribe", "The minimum is €5.00 per month");
  if (cents! > 100_00) fail("/subscribe", "The maximum is €100.00 per month");
  redirect(await startSubscription(user.id, user.email, cents!));
}

export async function cancel() {
  const user = await requireUser();
  await cancelSubscription(user.id);
  revalidatePath("/account");
}

export async function resume() {
  const user = await requireUser();
  await resumeSubscription(user.id);
  revalidatePath("/account");
}

export async function buyAlbum(form: FormData) {
  const user = await currentUser();
  const albumId = String(form.get("albumId"));
  if (!user) redirect(`/login?next=/album/${albumId}`);
  const album = await db.album.findUnique({ where: { id: albumId } });
  if (!album?.published) fail("/", "Album not found");
  redirect(await startAlbumPurchase(user!.id, user!.email, albumId));
}

export async function donate(form: FormData) {
  const user = await currentUser();
  const cents = parseEuroInput(form.get("amount"));
  if (!cents || cents < MIN_DONATION_CENTS) fail("/transparency", "The minimum donation is €1.00");
  redirect(await startDonation(user?.id ?? null, cents!));
}

// ------------------------------------------------------------------ studio
// Album edits redirect back to the editor (rather than only revalidating)
// so the URL loses any ?error= left from an earlier failed save.

const albumSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(2000).default(""),
});

async function ownAlbum(albumId: string) {
  const { artist } = await requireArtist();
  const album = await db.album.findUnique({ where: { id: albumId }, include: { tracks: true } });
  if (!album || album.artistId !== artist.id) redirect("/studio");
  return album!;
}

export async function createAlbum(form: FormData) {
  const { artist } = await requireArtist();
  const parsed = albumSchema.safeParse({ title: form.get("title"), description: form.get("description") ?? "" });
  if (!parsed.success) fail("/studio", parsed.error!.issues[0].message);
  const price = parseEuroInput(form.get("price"));
  if (!price || price < MIN_ALBUM_CENTS) fail("/studio", "Album price must be at least €1.00");
  const album = await db.album.create({ data: { artistId: artist.id, ...parsed.data!, priceCents: price! } });
  redirect(`/studio/albums/${album.id}`);
}

export async function updateAlbum(form: FormData) {
  const album = await ownAlbum(String(form.get("albumId")));
  const back = `/studio/albums/${album.id}`;
  const parsed = albumSchema.safeParse({ title: form.get("title"), description: form.get("description") ?? "" });
  if (!parsed.success) fail(back, parsed.error!.issues[0].message);
  const price = parseEuroInput(form.get("price"));
  if (!price || price < MIN_ALBUM_CENTS) fail(back, "Album price must be at least €1.00");
  const genres = [...new Set(form.getAll("genres"))].filter(isGenre);
  if (genres.length > MAX_GENRES) fail(back, `Pick up to ${MAX_GENRES} genres`);
  await db.album.update({ where: { id: album.id }, data: { ...parsed.data!, priceCents: price!, genres } });
  redirect(back);
}

/** "1:05", "65" or "" (= 0) to seconds; null if invalid. */
function parseStart(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const m = /^(?:(\d+):)?(\d+)$/.exec(s);
  if (!m) return null;
  if (m[1] !== undefined && Number(m[2]) > 59) return null;
  return m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[2]);
}

export async function setPreview(form: FormData) {
  const album = await ownAlbum(String(form.get("albumId")));
  const back = `/studio/albums/${album.id}`;
  const trackId = String(form.get("trackId") ?? "");
  if (!trackId) {
    // Back to automatic: first track, from 30 seconds in.
    await db.album.update({ where: { id: album.id }, data: { previewTrackId: null, previewStartSec: 0 } });
    redirect(back);
    return;
  }
  const track = album.tracks.find((t) => t.id === trackId && t.status === "READY");
  if (!track) fail(back, "Pick a finished track for the preview");
  const start = parseStart(form.get("start"));
  if (start === null) fail(back, "Write the preview start as minutes:seconds, for example 1:05");
  const max = latestStart(track!.durationSec);
  if (start! > max) fail(back, `The preview must start by ${Math.floor(max / 60)}:${String(max % 60).padStart(2, "0")} to fit 15 seconds`);
  await db.album.update({ where: { id: album.id }, data: { previewTrackId: track!.id, previewStartSec: start! } });
  redirect(back);
}

export async function setPublished(form: FormData) {
  const album = await ownAlbum(String(form.get("albumId")));
  const publish = form.get("publish") === "1";
  if (publish && !album.tracks.some((t) => t.status === "READY")) fail(`/studio/albums/${album.id}`, "Add at least one finished track first");
  await db.album.update({ where: { id: album.id }, data: { published: publish, releasedAt: publish ? (album.releasedAt ?? new Date()) : album.releasedAt } });
  redirect(`/studio/albums/${album.id}`);
}

export async function renameTrack(form: FormData) {
  const album = await ownAlbum(String(form.get("albumId")));
  const trackId = String(form.get("trackId"));
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  if (title && album.tracks.some((t) => t.id === trackId)) await db.track.update({ where: { id: trackId }, data: { title } });
  redirect(`/studio/albums/${album.id}`);
}

export async function deleteTrack(form: FormData) {
  const album = await ownAlbum(String(form.get("albumId")));
  const trackId = String(form.get("trackId"));
  if (!album.tracks.some((t) => t.id === trackId)) return;
  // Tracks with counted plays are kept for payout history; hide them instead.
  if (await db.play.count({ where: { trackId } })) fail(`/studio/albums/${album.id}`, "This track has plays and is part of payout history; unpublish the album instead");
  await db.track.delete({ where: { id: trackId } });
  await deletePrefix(`tracks/${trackId}/`);
  const rest = album.tracks.filter((t) => t.id !== trackId).sort((a, b) => a.number - b.number);
  for (const [i, t] of rest.entries()) await db.track.update({ where: { id: t.id }, data: { number: i + 1 } });
  redirect(`/studio/albums/${album.id}`);
}

const COVER_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export async function uploadCover(form: FormData) {
  const album = await ownAlbum(String(form.get("albumId")));
  const file = form.get("cover");
  const back = `/studio/albums/${album.id}`;
  if (!(file instanceof File) || !COVER_TYPES[file.type]) fail(back, "Upload a JPG, PNG or WebP image");
  if ((file as File).size > 8 * 1024 ** 2) fail(back, "Cover image must be under 8 MB");
  const dir = await mkdtemp(path.join(os.tmpdir(), "castalia-cover-"));
  try {
    const ext = COVER_TYPES[(file as File).type];
    const tmp = path.join(dir, `cover${ext}`);
    await writeFile(tmp, Buffer.from(await (file as File).arrayBuffer()));
    const key = `covers/${album.id}-${Date.now()}${ext}`;
    await putFile(key, tmp, (file as File).type);
    await db.album.update({ where: { id: album.id }, data: { coverKey: key } });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  redirect(back);
}

export async function updateArtistProfile(form: FormData) {
  const { artist } = await requireArtist();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const bio = String(form.get("bio") ?? "").trim().slice(0, 2000);
  if (!name) fail("/studio", "Enter an artist name");
  await db.artist.update({ where: { id: artist.id }, data: { name, bio } });
  revalidatePath("/studio");
}

export async function connectPayouts() {
  const { artist } = await requireArtist();
  redirect(await artistOnboardingUrl(artist.id));
}

// ------------------------------------------------------------------- admin

export async function setHostingCost(form: FormData) {
  await requireAdmin();
  const month = String(form.get("month") ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail("/admin", "Month must look like 2026-10");
  const raw = String(form.get("amount") ?? "").trim();
  const cents = raw === "0" ? 0 : parseEuroInput(raw);
  if (cents === null) fail("/admin", "Enter the hosting cost in euros");
  const note = String(form.get("note") ?? "").slice(0, 500);
  if (await db.payoutRun.findUnique({ where: { month } })) fail("/admin", `${month} is already closed`);
  await db.hostingCost.upsert({ where: { month }, create: { month, amountCents: cents!, note }, update: { amountCents: cents!, note } });
  revalidatePath("/admin");
}

export async function closeMonth(form: FormData) {
  await requireAdmin();
  try {
    await createPayoutRun(String(form.get("month")));
  } catch (e) {
    fail("/admin", e instanceof Error ? e.message : "Could not close the month");
  }
  revalidatePath("/admin");
}

export async function reopenMonth(form: FormData) {
  await requireAdmin();
  try {
    await deletePayoutRun(String(form.get("runId")));
  } catch (e) {
    fail("/admin", e instanceof Error ? e.message : "Could not reopen the month");
  }
  revalidatePath("/admin");
}

export async function payArtists(form: FormData) {
  await requireAdmin();
  const r = await payRun(String(form.get("runId")));
  redirect(`/admin?paid=${r.paid}&waiting=${r.waiting}`);
}

export async function demoEndPeriods() {
  await requireAdmin();
  await demoEndPeriodsNow();
  redirect("/admin?ended=1");
}
