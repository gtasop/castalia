import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { sendMail } from "./mail";

// "Forgot your password?": a random link, emailed, that works once and for
// an hour. Only its SHA-256 hash is stored. Asking again replaces any earlier
// link, so only the newest one works.

export const RESET_MINUTES = 60;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** Emails a reset link if there is an account for `email`; does nothing otherwise. */
export async function sendResetEmail(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, passwordHash: true } });
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.deleteMany({ where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] } });
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } });
  await sendMail({ to: user.email, ...resetEmail(user.name, `${appUrl()}/reset?token=${token}`, !user.passwordHash) });
}

export function resetEmail(name: string, link: string, googleOnly: boolean) {
  return {
    subject: googleOnly ? "Set a password for Castalia" : "Choose a new password for Castalia",
    text: [
      `Hi ${name},`,
      "",
      googleOnly
        ? "You asked to set a password for your Castalia account. You sign in with Google now; with a password you can also log in with your email."
        : "You asked to choose a new password for your Castalia account.",
      "",
      `Open this link within ${RESET_MINUTES} minutes to do it:`,
      link,
      "",
      "If you didn't ask for this, you can ignore this email: nothing changes until the link is used.",
      "",
      "Castalia",
    ].join("\n"),
  };
}

/** The reset a token belongs to, if the token is well-formed, known and not expired. */
export async function findReset(token: unknown) {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { email: true } } } });
  return reset && reset.expiresAt > new Date() ? reset : null;
}
