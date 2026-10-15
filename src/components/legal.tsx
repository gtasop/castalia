import { LEGAL_UPDATED, operator } from "@/lib/legal";

/** Layout for the legal pages: title, date, readable column. */
export function LegalPage({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="max-w-2xl">
      <h1 className="h1">{title}</h1>
      <p className="mt-2 font-mono text-xs text-muted">Last updated {LEGAL_UPDATED}</p>
      {intro && <div className="mt-4 text-muted">{intro}</div>}
      <div className="legal mt-8 space-y-8">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="h2">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** A value the operator still has to set in the environment, shown loudly so it's never missed. */
export function Missing({ name }: { name: string }) {
  return <mark className="rounded bg-danger/15 px-1 font-mono text-xs text-danger">[set {name}]</mark>;
}

export function OperatorName() {
  const { name } = operator();
  return name ? <>{name}</> : <Missing name="LEGAL_NAME" />;
}

export function ContactEmail() {
  const { email } = operator();
  return email ? (
    <a className="link" href={`mailto:${email}`}>
      {email}
    </a>
  ) : (
    <Missing name="LEGAL_EMAIL" />
  );
}

export function OperatorCountry() {
  const { country } = operator();
  return country ? <>{country}</> : <Missing name="LEGAL_COUNTRY" />;
}

export function OperatorAddress() {
  const { address } = operator();
  return (
    <address className="not-italic">
      <OperatorName />
      <br />
      {address?.length ? (
        address.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))
      ) : (
        <Missing name="LEGAL_ADDRESS" />
      )}
    </address>
  );
}
