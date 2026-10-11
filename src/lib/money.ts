export const MIN_SUBSCRIPTION_CENTS = 500;
export const MIN_ALBUM_CENTS = 100;
export const MIN_DONATION_CENTS = 100;

export function vatRate(): number {
  const r = Number(process.env.VAT_RATE ?? "0.21");
  return Number.isFinite(r) && r >= 0 ? r : 0.21;
}

/** VAT contained in a VAT-inclusive price. */
export function vatIncluded(grossCents: number, rate = vatRate()): number {
  return Math.round(grossCents - grossCents / (1 + rate));
}

/** Stripe's standard EU card fee, used in demo mode. */
export function simulatedCardFee(grossCents: number): number {
  return Math.round(grossCents * 0.015) + 25;
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Parse "7.50" or "7,50" into cents. Returns null if invalid. */
export function parseEuroInput(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`invalid month ${month}`);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}
