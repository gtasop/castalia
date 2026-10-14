/**
 * Where people can donate towards running costs: an external page such as
 * Open Collective, so Castalia itself never holds donations either. Set
 * DONATE_URL in .env; without it, donation links are hidden.
 */
export function donateUrl(): string | null {
  const url = process.env.DONATE_URL?.trim();
  return url && /^https:\/\//.test(url) ? url : null;
}
