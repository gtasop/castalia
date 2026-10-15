import Link from "next/link";
import { ContactEmail, LegalPage, OperatorAddress, OperatorCountry, Section } from "@/components/legal";

export const metadata = { title: "Legal notice" };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Legal notice">
      <Section title="Who runs Castalia">
        <p>Castalia is a non-commercial project run by a private individual. There is no company behind it.</p>
        <OperatorAddress />
        <p>
          Country: <OperatorCountry />
        </p>
        <p>
          Email: <ContactEmail />
        </p>
        <p>Castalia doesn&apos;t sell anything, so it has no VAT number or trade registration.</p>
      </Section>

      <Section title="Responsible for the content">
        <p>
          The person above is responsible for Castalia&apos;s own pages. Albums, covers and artist profiles are uploaded by the artists, who
          are responsible for them. To report something illegal or someone else&apos;s work uploaded without permission, see{" "}
          <Link href="/report" className="link">
            Report content
          </Link>
          .
        </p>
      </Section>

      <Section title="Buying albums">
        <p>
          When you buy an album, the seller is the artist, not Castalia: you pay them directly and they handle receipts, VAT and refunds.
          The details are in the{" "}
          <Link href="/terms" className="link">
            Terms
          </Link>
          .
        </p>
      </Section>

      <Section title="Links to other sites">
        <p>
          Castalia links to a few other sites, such as Stripe&apos;s payment pages and the donation page. Their owners are responsible for
          what they show.
        </p>
      </Section>
    </LegalPage>
  );
}
