// Album prices are set by the artist (VAT included) and paid to them directly.
export const MIN_ALBUM_CENTS = 100;
export const MAX_ALBUM_CENTS = 1_000_00;

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/**
 * Parse a euro amount typed by a person: "7", "7.5", "7,50", "€ 7.50".
 * Whole euros up to 7 digits and at most 2 decimals, with "." or "," as the
 * decimal mark. Anything else (thousands separators, "1e3", "0x10", other
 * digit systems) returns null, so it can't be misread: "1,000" is refused
 * rather than taken as €1.00.
 */
export function parseEuroInput(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value.replace(/[\s€]/g, ""));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

export type AmountCheck = { cents: number; error?: undefined } | { cents?: undefined; error: string };

/** Parse and range-check an amount, with a message for each way it can fail. */
export function checkAmount(value: FormDataEntryValue | null, min: number, max: number, what = "amount"): AmountCheck {
  const cents = parseEuroInput(value);
  if (cents === null) return { error: `Enter the ${what} in euros, for example 7.50` };
  if (cents < min) return { error: `The minimum ${what} is ${formatEur(min)}` };
  if (cents > max) return { error: `The maximum ${what} is ${formatEur(max)}` };
  return { cents };
}

