// Pure payout calculation. No database access, so it can be tested and
// audited on its own. All amounts are integer cents.
//
// For every subscription payment (already net of VAT and card fees):
//   1. It pays an equal share of the month's hosting cost, capped at
//      HOSTING_CAP of its net amount. Anything above the cap is drawn from
//      the donation reserve, so artists always receive at least 80%.
//   2. The rest goes to the artists that subscriber played (30s+ plays),
//      in proportion to their own plays (user-centric).
//   3. If the subscriber played nothing, the rest goes to the shared fund,
//      which is split across artists by their share of all plays.

export const HOSTING_CAP = 0.2;

export type PaymentInput = {
  paymentId: string;
  userId: string;
  netCents: number;
  /** artistId -> qualifying plays by this subscriber in the paid period */
  plays: Record<string, number>;
};

export type AllocationOut = {
  paymentId: string;
  userId: string;
  kind: "HOSTING" | "ARTIST_PLAYS" | "SHARED_FUND";
  artistId: string | null;
  plays: number;
  amountCents: number;
};

export type RunInput = {
  hostingCostCents: number;
  payments: PaymentInput[];
  /** Artists who share the fund equally if nobody played anything at all. */
  fallbackArtistIds: string[];
};

export type RunResult = {
  allocations: AllocationOut[];
  hostingCoveredCents: number;
  reserveDrawCents: number;
  /** Shared-fund money that could not go to any artist (no artists exist). */
  unallocatedCents: number;
  artists: Record<string, { subscriptionCents: number; sharedFundCents: number }>;
};

/**
 * Split `total` cents by `weights` so the parts always add up to exactly
 * `total` (largest remainder method, ties broken by order).
 */
export function splitCents(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error(`invalid total ${total}`);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k++, left--) parts[order[k % order.length].i]++;
  return parts;
}

export function calculateRun(input: RunInput): RunResult {
  const { payments, hostingCostCents } = input;
  const allocations: AllocationOut[] = [];
  const artists: RunResult["artists"] = {};
  const credit = (id: string, field: "subscriptionCents" | "sharedFundCents", c: number) => {
    artists[id] ??= { subscriptionCents: 0, sharedFundCents: 0 };
    artists[id][field] += c;
  };

  // 1. Hosting: equal share per payment, capped at 20% of its net amount.
  const equalShares = splitCents(hostingCostCents, payments.map(() => 1));
  let hostingCoveredCents = 0;
  let sharedFundCents = 0;
  const sharedFundPayments: { p: PaymentInput; amount: number }[] = [];

  payments.forEach((p, idx) => {
    const cap = Math.floor(p.netCents * HOSTING_CAP);
    const hosting = Math.min(equalShares[idx] ?? 0, cap);
    hostingCoveredCents += hosting;
    if (hosting > 0) {
      allocations.push({ paymentId: p.paymentId, userId: p.userId, kind: "HOSTING", artistId: null, plays: 0, amountCents: hosting });
    }

    // 2. User-centric split of what is left.
    const artistCents = p.netCents - hosting;
    const ids = Object.keys(p.plays).filter((a) => p.plays[a] > 0).sort();
    if (ids.length === 0) {
      sharedFundCents += artistCents;
      sharedFundPayments.push({ p, amount: artistCents });
      if (artistCents > 0) {
        allocations.push({ paymentId: p.paymentId, userId: p.userId, kind: "SHARED_FUND", artistId: null, plays: 0, amountCents: artistCents });
      }
      return;
    }
    const parts = splitCents(artistCents, ids.map((a) => p.plays[a]));
    ids.forEach((artistId, i) => {
      allocations.push({ paymentId: p.paymentId, userId: p.userId, kind: "ARTIST_PLAYS", artistId, plays: p.plays[artistId], amountCents: parts[i] });
      credit(artistId, "subscriptionCents", parts[i]);
    });
  });

  // 3. Shared fund: by each artist's share of all plays this run, or
  //    equally across all artists if nobody listened to anything.
  let unallocatedCents = 0;
  if (sharedFundCents > 0) {
    const totals: Record<string, number> = {};
    for (const p of payments) for (const [a, n] of Object.entries(p.plays)) totals[a] = (totals[a] ?? 0) + n;
    let ids = Object.keys(totals).filter((a) => totals[a] > 0).sort();
    let weights = ids.map((a) => totals[a]);
    if (ids.length === 0) {
      ids = [...input.fallbackArtistIds].sort();
      weights = ids.map(() => 1);
    }
    if (ids.length === 0) {
      unallocatedCents = sharedFundCents;
    } else {
      splitCents(sharedFundCents, weights).forEach((c, i) => credit(ids[i], "sharedFundCents", c));
    }
  }

  return {
    allocations,
    hostingCoveredCents,
    reserveDrawCents: hostingCostCents - hostingCoveredCents,
    unallocatedCents,
    artists,
  };
}
