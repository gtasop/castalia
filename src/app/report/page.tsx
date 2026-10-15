import Link from "next/link";
import { LegalPage, Missing, Section } from "@/components/legal";
import { db } from "@/lib/db";
import { isId } from "@/lib/ids";
import { operator } from "@/lib/legal";

export const metadata = { title: "Report content" };

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ album?: string | string[] }> }) {
  const raw = (await searchParams).album;
  const albumId = Array.isArray(raw) ? raw[0] : raw;
  // Only a real album's address goes into the email, never arbitrary text from the link.
  const album = isId(albumId) ? await db.album.findFirst({ where: { id: albumId, published: true }, select: { id: true, title: true } }) : null;
  const where = album ? `${appUrl()}/album/${album.id}` : "";
  const { email } = operator();

  const body = [
    "Where is it? (link to the album, track or artist page)",
    where || "",
    "",
    "What is the problem, and why is it illegal or against the terms?",
    "",
    "",
    "If it's your work: who you are, and what you own the rights to",
    "",
    "",
    "Your name:",
    "",
    "I believe in good faith that the information in this report is accurate and complete.",
  ].join("\n");
  const subject = album ? `Report: ${album.title}` : "Report: content on Castalia";
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;

  return (
    <LegalPage
      title="Report content"
      intro={<p>Tell us about anything on Castalia that&apos;s illegal, uploaded without the rights holder&apos;s permission, or against the terms.</p>}
    >
      <Section title="Send a report">
        {album && (
          <p>
            You&apos;re reporting <strong className="[overflow-wrap:anywhere]">{album.title}</strong>. Its link is already filled in.
          </p>
        )}
        <p>Please include:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Where it is: the link to the album, track or artist page.</li>
          <li>What the problem is, and why you think it&apos;s illegal or against the terms.</li>
          <li>If it&apos;s your work: who you are and what you hold the rights to.</li>
          <li>Your name and email, so we can tell you what we decide.</li>
          <li>A statement that you believe the report is accurate and complete.</li>
        </ul>
        {mailto ? (
          <a href={mailto} className="btn mt-2">
            Write the report by email
          </a>
        ) : (
          <p>
            The contact address isn&apos;t set up yet: <Missing name="LEGAL_EMAIL" />
          </p>
        )}
        {email && (
          <p className="text-muted">
            The button opens your email app with these questions filled in. You can also write to{" "}
            <a href={`mailto:${email}`} className="link">
              {email}
            </a>{" "}
            directly.
          </p>
        )}
      </Section>

      <Section title="What happens next">
        <p>
          We read every report ourselves and reply as soon as we can. If the content breaks the law or the terms, we remove or unpublish it,
          and in serious or repeated cases close the account. We tell you and the uploader what we decided and why, and either of you can
          reply to ask us to look again. How we decide is described in the{" "}
          <Link href="/terms" className="link">
            Terms
          </Link>
          , section 7.
        </p>
      </Section>
    </LegalPage>
  );
}
