"use server";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  MAX_PASSWORD_BYTES,
  passwordBytes,
  requireAdmin,
  requireArtist,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { errorQuery } from "@/lib/flash";
import type { FormState } from "@/lib/form-state";
import { isGenre, MAX_GENRES } from "@/lib/genres";
import { isId } from "@/lib/ids";
import { lock } from "@/lib/locks";
import {
  checkAmount,
  isMonth,
  MAX_ALBUM_CENTS,
  MAX_DONATION_CENTS,
  MAX_HOSTING_CENTS,
  MAX_SUBSCRIPTION_CENTS,
  MIN_ALBUM_CENTS,
  MIN_DONATION_CENTS,
  MIN_SUBSCRIPTION_CENTS,
} from "@/lib/money";
import {
  AlreadySubscribed,
  artistOnboardingUrl,
  cancelSubscription,
  demoEndPeriodsNow,
  resumeSubscription,
  startAlbumPurchase,
  startDonation,
  startSubscription,
} from "@/lib/payments";
import { createPayoutRun, deletePayoutRun, PayoutError, payRun } from "@/lib/payouts/run";
import { latestStart } from "@/lib/previews";
import { allow, clientIp } from "@/lib/rate-limit";
import { safeNext } from "@/lib/redirect";
import { albumSearchText } from "@/lib/search";
import { deleteFile, deletePrefix, putFile } from "@/lib/storage";
import { charCount, cleanBlock, cleanLine } from "@/lib/text";
import { isTheme, setThemeCookie, themePreference, toThemeEnum, toThemePref } from "@/lib/theme";

// Two kinds of failure:
// - Form actions (used with useActionState) return the message plus what
//   was typed, so the form is shown again with the person's input.
// - Other actions redirect back with a signed ?error= (see lib/flash.ts).

const fail = (to: string, msg: string): never => redirect(`${to}${to.includes("?") ? "&" : "?"}${errorQuery(msg)}`);

/** What was typed, to put back in the form (never passwords). */
function typed(form: FormData, names: string[]) {
  const values: Record<string, string | string[]> = {};
  for (const n of names) {
    const all = form.getAll(n).filter((v): v is string => typeof v === "string");
    values[n] = n === "genres" ? all : (all[0] ?? "");
  }
  return values;
}
const formError = (form: FormData, error: string, ...names: string[]): FormState => ({ error, values: typed(form, names) });


const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/u;
function normaliseEmail(v: unknown) {
  return cleanLine(v, 300).normalize("NFC").toLowerCase();
}

function isUniqueViolation(e: unknown) {
  return (e as { code?: string })?.code === "P2002";
}

// ------------------------------------------------------------------ auth

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const err = (msg: string) => formError(form, msg, "name", "email", "role", "next");
  if (!allow(`signup:${await clientIp()}`, 10, 3600)) return err("Too many sign-ups from this connection. Try again in an hour.");

  const name = cleanLine(form.get("name"), 1000);
  const email = normaliseEmail(form.get("email"));
  const password = form.get("password");
  const role = form.get("role");
  if (role !== "LISTENER" && role !== "ARTIST") return err("Choose whether you are a listener or an artist");
  if (!name) return err("Enter your name");
  if (charCount(name) > 100) return err("Names can be at most 100 characters");
  if (email.length > 254 || !EMAIL.test(email)) return err("Enter a valid email address");
  if (typeof password !== "string" || [...password].length < 8) return err("Passwords need at least 8 characters");
  if (passwordBytes(password) > MAX_PASSWORD_BYTES) return err("That password is too long. Use at most 72 bytes (72 plain letters, fewer with accents or emoji).");

  if (await db.user.findUnique({ where: { email } })) return err("An account with this email already exists. Log in instead.");
  let userId: string;
  try {
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
    userId = user.id;
  } catch (e) {
    if (isUniqueViolation(e)) return err("An account with this email already exists. Log in instead.");
    throw e;
  }
  await createSession(userId);
  const next = safeNext(form.get("next"));
  redirect(next !== "/" ? next : role === "ARTIST" ? "/studio" : "/subscribe");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = normaliseEmail(form.get("email"));
  const password = form.get("password");
  const err = (msg: string) => formError(form, msg, "email", "next");
  const ip = await clientIp();
  if (!allow(`login:${ip}`, 50, 900) || !allow(`login:${ip}:${email}`, 10, 900)) {
    return err("Too many attempts. Wait 15 minutes and try again.");
  }
  if (typeof password !== "string" || !email) return err("Wrong email or password");
  const user = email.length <= 254 ? await db.user.findUnique({ where: { email } }) : null;
  if (!(await verifyPassword(password, user?.passwordHash ?? null))) return err("Wrong email or password");
  await createSession(user!.id);
  await setThemeCookie(toThemePref(user!.theme));
  redirect(safeNext(form.get("next")));
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

export async function subscribe(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/subscribe");
  const amount = checkAmount(form.get("amount"), MIN_SUBSCRIPTION_CENTS, MAX_SUBSCRIPTION_CENTS, "monthly amount");
  if (amount.error) return formError(form, amount.error, "amount");
  let url: string;
  try {
    url = await startSubscription(user.id, user.email, amount.cents!);
  } catch (e) {
    if (e instanceof AlreadySubscribed) return formError(form, e.message, "amount");
    throw e;
  }
  redirect(url);
}

export async function cancel() {
  const user = await requireUser("/account");
  await cancelSubscription(user.id);
  redirect("/account?cancelled=1");
}

export async function resume() {
  const user = await requireUser("/account");
  await resumeSubscription(user.id);
  redirect("/account?resumed=1");
}

export async function buyAlbum(form: FormData) {
  const albumId = form.get("albumId");
  if (!isId(albumId)) fail("/albums", "That album doesn't exist");
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/album/${albumId}`)}`);
  const album = await db.album.findUnique({
    where: { id: albumId as string },
    select: { id: true, published: true, _count: { select: { tracks: { where: { status: "READY" } } } } },
  });
  if (!album?.published) fail("/albums", "This album isn't for sale");
  if (album!._count.tracks === 0) fail(`/album/${album!.id}`, "This album has no tracks yet, so it can't be bought");
  if (await db.purchase.findUnique({ where: { userId_albumId: { userId: user!.id, albumId: album!.id } }, select: { id: true } })) {
    redirect(`/album/${album!.id}?owned=1`);
  }
  redirect(await startAlbumPurchase(user!.id, user!.email, album!.id));
}

export async function donate(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!allow(`donate:${await clientIp()}`, 10, 3600)) return formError(form, "Too many donations from this connection. Try again later.", "amount");
  const amount = checkAmount(form.get("amount"), MIN_DONATION_CENTS, MAX_DONATION_CENTS, "donation");
  if (amount.error) return formError(form, amount.error, "amount");
  redirect(await startDonation(user?.id ?? null, amount.cents!));
}

// ------------------------------------------------------------------ studio
// Album edits redirect back to the editor so the URL loses any ?error=
// left from an earlier failed action.

function albumTitle(form: FormData): { title: string; error?: string } {
  const title = cleanLine(form.get("title"), 1000);
  if (!title) return { title, error: "Enter a title" };
  if (charCount(title) > 200) return { title, error: "Titles can be at most 200 characters" };
  return { title };
}

async function ownAlbum(albumId: unknown) {
  const { artist } = await requireArtist("/studio");
  if (!isId(albumId)) redirect("/studio");
  const album = await db.album.findUnique({ where: { id: albumId as string }, include: { tracks: true } });
  if (!album || album.artistId !== artist.id) redirect("/studio");
  return { album: album!, artist };
}

export async function createAlbum(_: FormState, form: FormData): Promise<FormState> {
  const { artist } = await requireArtist("/studio");
  const t = albumTitle(form);
  if (t.error) return formError(form, t.error, "title", "price");
  const price = checkAmount(form.get("price"), MIN_ALBUM_CENTS, MAX_ALBUM_CENTS, "price");
  if (price.error) return formError(form, price.error, "title", "price");
  const album = await db.album.create({
    data: { artistId: artist.id, title: t.title, priceCents: price.cents!, searchText: albumSearchText(t.title, artist.name) },
  });
  redirect(`/studio/albums/${album.id}`);
}

export async function updateAlbum(_: FormState, form: FormData): Promise<FormState> {
  const { album, artist } = await ownAlbum(form.get("albumId"));
  const back = `/studio/albums/${album.id}`;
  const err = (msg: string) => formError(form, msg, "title", "description", "price", "genres");
  const t = albumTitle(form);
  if (t.error) return err(t.error);
  const description = cleanBlock(form.get("description"), 100_000);
  if (charCount(description) > 2000) return err("Descriptions can be at most 2,000 characters");
  const price = checkAmount(form.get("price"), MIN_ALBUM_CENTS, MAX_ALBUM_CENTS, "price");
  if (price.error) return err(price.error);
  const genres = [...new Set(form.getAll("genres"))].filter(isGenre);
  if (genres.length > MAX_GENRES) return err(`Pick up to ${MAX_GENRES} genres`);
  await db.album.update({
    where: { id: album.id },
    data: { title: t.title, description, priceCents: price.cents!, genres, searchText: albumSearchText(t.title, artist.name) },
  });
  redirect(`${back}?saved=details`);
}

/** "1:05", "65" or "" (= 0) to seconds; null if invalid. */
function parseStart(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const m = /^(?:(\d{1,3}):)?(\d{1,5})$/.exec(s);
  if (!m) return null;
  if (m[1] !== undefined && Number(m[2]) > 59) return null;
  return m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[2]);
}

export async function setPreview(_: FormState, form: FormData): Promise<FormState> {
  const { album } = await ownAlbum(form.get("albumId"));
  const back = `/studio/albums/${album.id}`;
  const err = (msg: string) => formError(form, msg, "trackId", "start");
  const trackId = String(form.get("trackId") ?? "");
  if (!trackId) {
    // Back to automatic: first track, from 30 seconds in.
    await db.album.update({ where: { id: album.id }, data: { previewTrackId: null, previewStartSec: 0 } });
    redirect(`${back}?saved=preview`);
  }
  const track = album.tracks.find((t) => t.id === trackId && t.status === "READY");
  if (!track) return err("Pick a finished track for the preview");
  const start = parseStart(form.get("start"));
  if (start === null) return err("Write the preview start as minutes:seconds, for example 1:05");
  const max = latestStart(track.durationSec);
  if (start > max) return err(`The preview must start by ${Math.floor(max / 60)}:${String(max % 60).padStart(2, "0")} to fit 15 seconds`);
  await db.album.update({ where: { id: album.id }, data: { previewTrackId: track.id, previewStartSec: start } });
  redirect(`${back}?saved=preview`);
}

export async function setPublished(form: FormData) {
  const { album } = await ownAlbum(form.get("albumId"));
  const publish = form.get("publish") === "1";
  if (publish && !album.tracks.some((t) => t.status === "READY")) fail(`/studio/albums/${album.id}`, "Add at least one finished track first");
  await db.album.update({ where: { id: album.id }, data: { published: publish, releasedAt: publish ? (album.releasedAt ?? new Date()) : album.releasedAt } });
  redirect(`/studio/albums/${album.id}`);
}

export async function renameTrack(form: FormData) {
  const { album } = await ownAlbum(form.get("albumId"));
  const back = `/studio/albums/${album.id}`;
  const trackId = String(form.get("trackId"));
  if (!album.tracks.some((t) => t.id === trackId)) redirect(back);
  const title = cleanLine(form.get("title"), 1000);
  if (!title) fail(back, "Track titles can't be empty");
  if (charCount(title) > 200) fail(back, "Track titles can be at most 200 characters");
  await db.track.update({ where: { id: trackId }, data: { title } });
  redirect(back);
}

export async function deleteTrack(form: FormData) {
  const { album } = await ownAlbum(form.get("albumId"));
  const back = `/studio/albums/${album.id}`;
  const trackId = String(form.get("trackId"));
  const track = album.tracks.find((t) => t.id === trackId);
  if (!track) redirect(back);
  if (track!.status === "PROCESSING") fail(back, "This track is still being converted. Delete it once it's finished.");
  // Tracks with counted plays are kept for payout history; hide them instead.
  if (track!.status === "READY" && (await db.play.count({ where: { trackId } }))) {
    fail(back, "This track has plays and is part of payout history, so it can't be deleted. You can unpublish the album instead; buyers keep it.");
  }
  const readyLeft = album.tracks.filter((t) => t.status === "READY" && t.id !== trackId).length;
  if (album.published && track!.status === "READY" && readyLeft === 0) {
    fail(back, "This is the last track of a published album. Add another track or unpublish the album first.");
  }
  await db.$transaction(async (tx) => {
    await lock(tx, `album-tracks:${album.id}`);
    await tx.track.delete({ where: { id: trackId } });
    if (album.previewTrackId === trackId) await tx.album.update({ where: { id: album.id }, data: { previewTrackId: null, previewStartSec: 0 } });
    const rest = await tx.track.findMany({ where: { albumId: album.id }, orderBy: { number: "asc" }, select: { id: true } });
    for (const [i, t] of rest.entries()) await tx.track.update({ where: { id: t.id }, data: { number: i + 1 } });
  });
  await deletePrefix(`tracks/${trackId}/`);
  redirect(back);
}

/** The image type from the file's first bytes; the browser's claim is ignored. */
function imageType(bytes: Buffer): { ext: string; mime: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: ".jpg", mime: "image/jpeg" };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: ".png", mime: "image/png" };
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return { ext: ".webp", mime: "image/webp" };
  return null;
}

export async function uploadCover(form: FormData) {
  const { album } = await ownAlbum(form.get("albumId"));
  const file = form.get("cover");
  const back = `/studio/albums/${album.id}`;
  if (!(file instanceof File)) fail(back, "Choose an image");
  if ((file as File).size > 8 * 1024 ** 2) fail(back, "Cover images must be under 8 MB");
  const bytes = Buffer.from(await (file as File).arrayBuffer());
  const type = imageType(bytes);
  if (!type) fail(back, "Upload a JPG, PNG or WebP image");
  const dir = await mkdtemp(path.join(os.tmpdir(), "castalia-cover-"));
  try {
    const tmp = path.join(dir, `cover${type!.ext}`);
    await writeFile(tmp, bytes);
    const key = `covers/${album.id}-${Date.now()}${type!.ext}`;
    await putFile(key, tmp, type!.mime);
    await db.album.update({ where: { id: album.id }, data: { coverKey: key } });
    if (album.coverKey && album.coverKey !== key) await deleteFile(album.coverKey).catch(() => {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  redirect(back);
}

export async function updateArtistProfile(_: FormState, form: FormData): Promise<FormState> {
  const { artist } = await requireArtist("/studio");
  const err = (msg: string) => formError(form, msg, "name", "bio");
  const name = cleanLine(form.get("name"), 1000);
  const bio = cleanBlock(form.get("bio"), 100_000);
  if (!name) return err("Enter an artist name");
  if (charCount(name) > 100) return err("Artist names can be at most 100 characters");
  if (charCount(bio) > 2000) return err("Bios can be at most 2,000 characters");
  await db.$transaction(async (tx) => {
    await tx.artist.update({ where: { id: artist.id }, data: { name, bio } });
    // Keep search in step with the new name.
    const albums = await tx.album.findMany({ where: { artistId: artist.id }, select: { id: true, title: true } });
    for (const a of albums) await tx.album.update({ where: { id: a.id }, data: { searchText: albumSearchText(a.title, name) } });
  });
  redirect("/studio?saved=profile");
}

export async function connectPayouts() {
  const { artist } = await requireArtist("/studio/payouts");
  redirect(await artistOnboardingUrl(artist.id));
}

// ------------------------------------------------------------------- admin

export async function setHostingCost(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin("/admin");
  const err = (msg: string) => formError(form, msg, "month", "amount", "note");
  const month = form.get("month");
  if (!isMonth(month)) return err("Month must look like 2026-10");
  const amount = checkAmount(form.get("amount"), 0, MAX_HOSTING_CENTS, "hosting cost");
  if (amount.error) return err(amount.error);
  const note = cleanLine(form.get("note"), 500);
  if (await db.payoutRun.findUnique({ where: { month } })) return err(`${month} is already closed, so its hosting bill can't change`);
  await db.hostingCost.upsert({ where: { month }, create: { month, amountCents: amount.cents!, note }, update: { amountCents: amount.cents!, note } });
  redirect("/admin?saved=hosting");
}

async function adminStep(work: () => Promise<unknown>, generic: string) {
  try {
    await work();
  } catch (e) {
    if (e instanceof PayoutError) fail("/admin", e.message);
    console.error(e);
    fail("/admin", generic);
  }
}

export async function closeMonth(form: FormData) {
  await requireAdmin("/admin");
  await adminStep(() => createPayoutRun(String(form.get("month") ?? "")), "Closing the month failed. Nothing was changed.");
  redirect("/admin?closed=1");
}

export async function reopenMonth(form: FormData) {
  await requireAdmin("/admin");
  const runId = form.get("runId");
  if (!isId(runId)) fail("/admin", "That month isn't closed (any more).");
  await adminStep(() => deletePayoutRun(runId as string), "Reopening the month failed. Nothing was changed.");
  redirect("/admin?reopened=1");
}

export async function payArtists(form: FormData) {
  await requireAdmin("/admin");
  const runId = form.get("runId");
  if (!isId(runId)) fail("/admin", "That month isn't closed (any more).");
  let result = { paid: 0, waiting: 0 };
  await adminStep(async () => {
    result = await payRun(runId as string);
  }, "Paying failed. Artists who weren't paid can be paid again; nobody is paid twice.");
  redirect(`/admin?paid=${result.paid}&waiting=${result.waiting}`);
}

export async function demoEndPeriods() {
  await requireAdmin("/admin");
  await demoEndPeriodsNow();
  redirect("/admin?ended=1");
}
