import Link from "next/link";
import { ContactEmail, LegalPage, OperatorCountry, OperatorName, Section } from "@/components/legal";
import { MIN_AGE } from "@/lib/legal";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      intro={
        <p>
          These terms are an agreement between you and <OperatorName />, who runs Castalia (&quot;we&quot;). By creating an account you
          agree to them. They&apos;re written to be read; if anything is unclear, ask us at <ContactEmail />.
        </p>
      }
    >
      <Section title="1. What Castalia is">
        <p>
          Castalia is a non-profit place to listen to and buy music. Artists upload albums and sell them directly to listeners. We take no
          cut of sales and never hold anyone&apos;s money. The running costs are paid by donations.
        </p>
      </Section>

      <Section title="2. Your account">
        <ul className="list-disc space-y-1 pl-5">
          <li>You must be {MIN_AGE} or older to have an account.</li>
          <li>Use your real email address and keep your password (or Google account) safe. You&apos;re responsible for what happens in your account.</li>
          <li>One account per person. Artist accounts are for the artist or someone who may act for them.</li>
        </ul>
      </Section>

      <Section title="3. Listening">
        <p>
          With an account you can hear a 15-second preview of every album and the tracks each artist has made open. Streaming is for your
          own personal listening. Don&apos;t record, rip or redistribute what you stream.
        </p>
      </Section>

      <Section title="4. Buying an album">
        <p>
          <strong>You buy from the artist, not from us.</strong> The sale is a contract between you and the artist. You pay them directly,
          through their own Stripe account; the receipt comes from them, and they set the price (including any VAT they owe). Castalia
          isn&apos;t a party to the sale and receives nothing from it.
        </p>
        <p>
          <strong>What you get.</strong> A personal licence from the artist to stream the album on Castalia and to download DRM-free copies
          for your own private, non-commercial use. You may not resell, share or upload the album elsewhere.
        </p>
        <p>
          <strong>Your right to cancel.</strong> If you&apos;re a consumer in the EU, you normally have 14 days to cancel a purchase made
          online. Albums are delivered straight away, so before you pay we ask you to confirm that you want immediate access and that you
          understand you lose the right to cancel once the purchase is complete. This doesn&apos;t affect your rights if the album is faulty
          or not as described: contact the artist, who must fix it or refund you.
        </p>
        <p>
          <strong>Refunds</strong> are handled by the artist. If they refund you in full, the album is removed from your account.
        </p>
        <p>
          <strong>Keeping your albums.</strong> You keep a bought album even if the artist later unpublishes it. If Castalia ever has to
          close, we&apos;ll give you at least 30 days&apos; notice wherever we can, so you can download what you own.
        </p>
      </Section>

      <Section title="5. For artists">
        <p>
          <strong>Your rights.</strong> You confirm that you own, or have permission to use, everything you upload: the recordings, the
          compositions and lyrics, samples, artwork and text. If a collecting society or anyone else must license or be paid for your
          music, that&apos;s your responsibility.
        </p>
        <p>
          <strong>What you allow us to do.</strong> You keep all your rights. You give us a free, non-exclusive, worldwide permission to
          store, copy and convert your uploads, stream them, offer downloads to your buyers, make previews, and show your covers and
          profile, only to run Castalia. The permission lasts while your music is on Castalia and, for albums someone has bought, for as long
          as those buyers keep access.
        </p>
        <p>
          <strong>You&apos;re the seller.</strong> You connect your own Stripe account, and Stripe&apos;s terms apply to it. You&apos;re
          responsible for your prices, VAT and other taxes, receipts, the information consumer law requires sellers to give, refunds and
          questions from buyers. We take no fee and never hold your money.
        </p>
        <p>
          <strong>Taking music down.</strong> You can unpublish an album at any time. People who already bought it keep it, so tracks of a
          bought album can&apos;t be deleted.
        </p>
      </Section>

      <Section title="6. What's not allowed">
        <ul className="list-disc space-y-1 pl-5">
          <li>Uploading anything illegal, or anyone else&apos;s work without their permission.</li>
          <li>Content that incites violence or hatred, or that harasses or threatens people.</li>
          <li>Pretending to be another artist or person.</li>
          <li>Getting around the limits on what you can hear or download, or downloading in bulk with scripts.</li>
          <li>Attacking, overloading or probing Castalia, or uploading malware.</li>
          <li>Misusing payments, for example disputing a charge for an album you received.</li>
        </ul>
      </Section>

      <Section title="7. Reports and moderation">
        <p>
          Anyone can tell us about illegal content or a breach of these terms, see{" "}
          <Link href="/report" className="link">
            Report content
          </Link>
          . We read every report and decide carefully, by hand; we don&apos;t use automated moderation, and we don&apos;t check uploads
          before they go up.
        </p>
        <p>
          If we act, for example by unpublishing an album, removing a track or suspending an account, we tell the person affected what we did
          and why, unless the law stops us. They can reply to that email to disagree, and we&apos;ll look at the decision again. We tell
          the person who reported it what we decided. We close the accounts of people who repeatedly upload others&apos; work. You can
          always also take a dispute to the courts.
        </p>
      </Section>

      <Section title="8. Availability">
        <p>
          Castalia is free to use and run on donations, so we can&apos;t promise it will always be available or never change. We may add,
          change or remove features. If we stop running Castalia, we&apos;ll give notice as described in section 4.
        </p>
      </Section>

      <Section title="9. Liability">
        <p>
          We&apos;re responsible as the law requires for harm we cause on purpose or through gross negligence, and for injury to life,
          body or health. Otherwise, as far as the law allows, we aren&apos;t liable for lost data, profits or other indirect losses, or for
          what artists upload or sell. Nothing in these terms limits the rights consumers have by law.
        </p>
      </Section>

      <Section title="10. Ending">
        <p>
          You can close your account at any time by emailing <ContactEmail />. We may suspend or close an account for a serious or repeated
          breach of these terms, and we&apos;ll tell you why.
        </p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>
          If we change these terms in a way that matters, we&apos;ll tell you by email or on Castalia at least 30 days before the change
          applies. If you don&apos;t agree, you can close your account before then.
        </p>
      </Section>

      <Section title="12. Law">
        <p>
          The law of <OperatorCountry /> applies. If you&apos;re a consumer living in the EU, you also keep the protection of the
          mandatory consumer laws of your own country, and you can take a claim to the courts where you live.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          <ContactEmail />. The full details are in the{" "}
          <Link href="/legal" className="link">
            Legal notice
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
