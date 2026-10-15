// Who runs Castalia, for the legal notice, terms and privacy policy. These
// come from the environment rather than the code, so the operator's name and
// postal address aren't committed to a public repository.

export const LEGAL_UPDATED = "15 October 2026";

/** Minimum age to have an account (the GDPR's default age of digital consent). */
export const MIN_AGE = 16;

export type Operator = { name?: string; address?: string[]; email?: string; country?: string };

export function operator(): Operator {
  const clean = (v?: string) => v?.trim() || undefined;
  const email = clean(process.env.LEGAL_EMAIL);
  return {
    name: clean(process.env.LEGAL_NAME),
    // One line per "|" so a multi-line address fits in one variable.
    address: clean(process.env.LEGAL_ADDRESS)
      ?.split("|")
      .map((l) => l.trim())
      .filter(Boolean),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    country: clean(process.env.LEGAL_COUNTRY),
  };
}
