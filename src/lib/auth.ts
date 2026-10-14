import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

const COOKIE = "castalia_session";
const SESSION_DAYS = 30;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

/** bcrypt only uses the first 72 bytes, so longer passwords are refused. */
export const MAX_PASSWORD_BYTES = 72;
export const passwordBytes = (pw: string) => Buffer.byteLength(pw, "utf8");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

// Compared against when the email is unknown, so a wrong email takes as
// long as a wrong password and response times don't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync("castalia-timing-equaliser", 12);

/** Checks a password; pass null for an unknown user to keep timing equal. */
export async function verifyPassword(pw: string, hash: string | null) {
  const ok = await bcrypt.compare(pw, hash ?? DUMMY_HASH);
  return ok && hash !== null;
}

export async function createSession(userId: string) {
  const jar = await cookies();
  // A login replaces the session this browser had, and tidies expired ones.
  const previous = jar.get(COOKIE)?.value;
  await db.session.deleteMany({
    where: { OR: [...(previous && TOKEN.test(previous) ? [{ id: previous }] : []), { expiresAt: { lt: new Date() } }] },
  });
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({ data: { id, userId, expiresAt } });
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id && TOKEN.test(id)) await db.session.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export const currentUser = cache(async () => {
  const id = (await cookies()).get(COOKIE)?.value;
  // Anything that isn't a well-formed token never reaches the database.
  if (!id || !TOKEN.test(id)) return null;
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { include: { artist: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** `back` is where to return after logging in. */
export async function requireUser(back?: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(back ? `/login?next=${encodeURIComponent(back)}` : "/login");
  return user;
}

export async function requireArtist(back?: string) {
  const user = await requireUser(back);
  if (!user.artist) redirect("/");
  return { user, artist: user.artist };
}

export async function requireAdmin(back?: string) {
  const user = await requireUser(back);
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
