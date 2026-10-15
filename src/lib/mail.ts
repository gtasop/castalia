import "server-only";

// Sends email through Resend's HTTP API (https://resend.com). Without
// RESEND_API_KEY and MAIL_FROM, emails are printed to the server console in
// development so flows like password reset can be tried locally.

export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!mailEnabled()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n──── email (not sent: no RESEND_API_KEY) ────\nTo: ${to}\nSubject: ${subject}\n\n${text}\n────────────────────────────────────────────\n`);
      return;
    }
    throw new Error("Email isn't set up: set RESEND_API_KEY and MAIL_FROM");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email to ${to} not sent (${res.status}): ${await res.text().catch(() => "")}`);
}
