import Link from "next/link";
import { ContactEmail, LegalPage, OperatorAddress, Section } from "@/components/legal";
import { MIN_AGE } from "@/lib/legal";

export const metadata = { title: "Privacy policy" };

const STORED: [string, string, string][] = [
  ["castalia_session", "Cookie", "Keeps you logged in. 30 days, or until you log out."],
  ["castalia_theme", "Cookie", "Remembers light, dark or system theme. 1 year."],
  ["castalia_google", "Cookie", "Checks that a Google sign-in coming back is the one you started. 10 minutes."],
  ["castalia_google_signup", "Cookie", "Holds your Google name and email while you finish signing up. 30 minutes."],
  ["castalia.volume, castalia.muted, castalia.quality", "Browser storage", "Your player volume and sound quality. Stays in your browser; never sent to us."],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={<p>Castalia collects as little as it can, uses it only to run the service, and never sells it, shows ads or tracks you around the web.</p>}
    >
      <Section title="Who is responsible">
        <p>The controller of your personal data is:</p>
        <OperatorAddress />
        <p>
          Email: <ContactEmail />
        </p>
      </Section>

      <Section title="What we collect and why">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Your account:</strong> name, email address, and either a password (stored only as a one-way hash, never readable) or
            your Google account ID if you sign in with Google. Also your theme choice and when you accepted the terms. Needed to provide
            your account (GDPR article 6(1)(b), a contract with you).
          </li>
          <li>
            <strong>Albums you buy:</strong> which album, the price, the date and Stripe&apos;s payment reference. Needed so you can
            stream and download what you bought (article 6(1)(b)).
          </li>
          <li>
            <strong>Plays:</strong> which track you played and when. Used to show artists how often their tracks are played, in totals
            that never name you, and to keep the service fair and working (article 6(1)(f), our legitimate interest).
          </li>
          <li>
            <strong>What artists upload:</strong> artist name, bio, audio, covers, album details and the artist&apos;s connected Stripe
            account ID. Shown publicly to members, because that&apos;s the point (article 6(1)(b)).
          </li>
          <li>
            <strong>Technical data:</strong> your IP address is kept briefly in memory, at most an hour, to slow down attempts to guess
            passwords. It&apos;s never written to our database (article 6(1)(f), keeping accounts secure).
          </li>
        </ul>
        <p>We don&apos;t use analytics, advertising or tracking tools, and we don&apos;t make automated decisions about you.</p>
      </Section>

      <Section title="When you buy an album">
        <p>
          You pay the artist through Stripe, on the artist&apos;s own Stripe account. Stripe collects your card details directly; we never
          see them. Because the artist is the seller, they receive your email address and payment details from Stripe and are responsible
          for them as a separate controller, for example to send receipts and keep tax records. Stripe&apos;s own{" "}
          <a className="link" href="https://stripe.com/privacy" target="_blank" rel="noreferrer">
            privacy policy
          </a>{" "}
          applies to what it processes.
        </p>
      </Section>

      <Section title="Who else handles your data">
        <ul className="list-disc space-y-1 pl-5">
          <li>Our hosting provider, which runs the server and database.</li>
          <li>Our storage provider, which holds the audio files and covers.</li>
          <li>
            Google, only if you choose to sign in with Google (
            <a className="link" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              Google&apos;s privacy policy
            </a>
            ).
          </li>
          <li>Stripe, for payments, as described above.</li>
          <li>Our email provider, which sends password-reset emails.</li>
        </ul>
        <p>
          Hosting and storage providers process data only on our instructions. Some providers may process data outside the EU; when they
          do, it&apos;s protected by the EU&apos;s standard contractual clauses or an adequacy decision such as the EU–US Data Privacy
          Framework. We never sell or rent your data.
        </p>
      </Section>

      <Section title="How long we keep it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your account, purchases and plays: until you close your account. Then we delete them within 30 days.</li>
          <li>
            An artist&apos;s albums: until the artist deletes them, except that albums someone bought stay available to those buyers.
          </li>
          <li>Login sessions: 30 days. Google sign-in cookies: 10 to 30 minutes. Password-reset links: 1 hour, or until used.</li>
          <li>Backups may hold deleted data for up to 30 more days before they&apos;re overwritten.</li>
        </ul>
      </Section>

      <Section title="Cookies and browser storage">
        <p>
          Castalia only stores what it needs to work. None of it tracks you, so there&apos;s no cookie banner: the law doesn&apos;t
          require consent for strictly necessary storage.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3 font-normal">Name</th>
                <th className="py-2 pr-3 font-normal">Type</th>
                <th className="py-2 font-normal">Purpose and lifetime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {STORED.map(([name, type, purpose]) => (
                <tr key={name}>
                  <td className="py-2 pr-3 font-mono [overflow-wrap:anywhere]">{name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{type}</td>
                  <td className="py-2">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask us for a copy of your data, to correct it, to delete it and close your account, to restrict or object to how we use
          it, or to receive it in a portable format. Email <ContactEmail /> from the address on your account; we&apos;ll answer within a
          month.
        </p>
        <p>
          You can also complain to a data protection authority, in particular the one in the EU country where you live or work. The{" "}
          <a className="link" href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noreferrer">
            list of EU data protection authorities
          </a>{" "}
          has their contact details.
        </p>
      </Section>

      <Section title="Age">
        <p>Castalia is for people aged {MIN_AGE} and over. If you think a younger person has an account, tell us and we&apos;ll delete it.</p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy in a way that matters, we&apos;ll tell you by email or on Castalia before the change applies. See also
          the{" "}
          <Link href="/terms" className="link">
            Terms
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
