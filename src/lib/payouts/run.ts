import { db } from "../db";
import { lock } from "../locks";
import { isMonth, monthRange } from "../money";
import { isDemoMode, transferToArtist } from "../payments";
import { calculateRun } from "./engine";

// Closing, reopening and paying all take the same lock, so concurrent
// clicks (or two admins) run one after another instead of interleaving.
const PAYOUT_LOCK = "payouts";
const LONG_TX = { timeout: 120_000, maxWait: 30_000 };

export class PayoutError extends Error {}

/**
 * Closes a month: allocates every unallocated subscription payment whose
 * period has ended by the end of that month, and every unallocated album
 * sale made before then, and records each artist's earnings. Anything that
 * arrives late for an already closed month is picked up by the next run.
 * Money is sent separately with `payRun`.
 */
export async function createPayoutRun(month: string) {
  if (!isMonth(month)) throw new PayoutError("Month must look like 2026-10");
  const { end } = monthRange(month);
  const now = new Date();
  // Normally a month is closed once it is over. Demo mode also allows the
  // current month, so the whole flow can be tried without waiting.
  const thisMonthEnd = monthRange(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`).end;
  if (end > now && !(isDemoMode() && end <= thisMonthEnd)) {
    throw new PayoutError(`${month} isn't over yet. Close it once the month has ended.`);
  }

  return db.$transaction(async (tx) => {
    await lock(tx, PAYOUT_LOCK);
    if (await tx.payoutRun.findUnique({ where: { month } })) throw new PayoutError(`${month} has already been closed.`);

    const payments = await tx.subscriptionPayment.findMany({
      where: { payoutRunId: null, periodEnd: { lt: end, lte: now } },
    });
    const paymentInputs = [];
    for (const p of payments) {
      const plays = await tx.play.groupBy({
        by: ["artistId"],
        where: { userId: p.userId, playedAt: { gte: p.periodStart, lt: p.periodEnd } },
        _count: { _all: true },
      });
      paymentInputs.push({
        paymentId: p.id,
        userId: p.userId,
        netCents: p.netCents,
        plays: Object.fromEntries(plays.map((x) => [x.artistId, x._count._all])),
      });
    }

    const hosting = await tx.hostingCost.findUnique({ where: { month } });
    const fallbackArtists = await tx.artist.findMany({ where: { albums: { some: { published: true } } }, select: { id: true } });
    const result = calculateRun({
      hostingCostCents: hosting?.amountCents ?? 0,
      payments: paymentInputs,
      fallbackArtistIds: fallbackArtists.map((a) => a.id),
    });

    const purchases = await tx.purchase.findMany({
      where: { payoutRunId: null, createdAt: { lt: end } },
      include: { album: { select: { artistId: true } } },
    });
    const sales: Record<string, number> = {};
    for (const p of purchases) sales[p.album.artistId] = (sales[p.album.artistId] ?? 0) + p.netCents;
    const artistIds = new Set([...Object.keys(result.artists), ...Object.keys(sales)]);

    const run = await tx.payoutRun.create({
      data: {
        month,
        hostingCostCents: hosting?.amountCents ?? 0,
        hostingCoveredCents: result.hostingCoveredCents,
        reserveDrawCents: result.reserveDrawCents,
      },
    });
    await tx.allocation.createMany({ data: result.allocations.map((a) => ({ ...a, payoutRunId: run.id })) });
    for (const artistId of artistIds) {
      const sub = result.artists[artistId]?.subscriptionCents ?? 0;
      const shared = result.artists[artistId]?.sharedFundCents ?? 0;
      const sale = sales[artistId] ?? 0;
      await tx.artistEarning.create({
        data: { payoutRunId: run.id, artistId, subscriptionCents: sub, sharedFundCents: shared, salesCents: sale, totalCents: sub + shared + sale },
      });
    }
    // Only rows that are still unallocated; anything else means a conflict.
    const linkedPayments = await tx.subscriptionPayment.updateMany({
      where: { id: { in: payments.map((p) => p.id) }, payoutRunId: null },
      data: { payoutRunId: run.id },
    });
    const linkedPurchases = await tx.purchase.updateMany({
      where: { id: { in: purchases.map((p) => p.id) }, payoutRunId: null },
      data: { payoutRunId: run.id },
    });
    if (linkedPayments.count !== payments.length || linkedPurchases.count !== purchases.length) {
      throw new PayoutError("Some payments were allocated by another run at the same time. Nothing was changed; try again.");
    }
    if (result.reserveDrawCents > 0) {
      await tx.reserveEntry.create({
        data: { kind: "HOSTING_SHORTFALL", amountCents: -result.reserveDrawCents, note: `Hosting above the 20% cap, ${month}`, payoutRunId: run.id },
      });
    }
    if (result.unallocatedCents > 0) {
      await tx.reserveEntry.create({
        data: { kind: "DONATION", amountCents: result.unallocatedCents, note: `Shared fund with no artists to receive it, ${month}`, payoutRunId: run.id },
      });
    }
    return run;
  }, LONG_TX);
}

/** Undo a closed month that has not started paying anyone. */
export async function deletePayoutRun(runId: string) {
  await db.$transaction(async (tx) => {
    await lock(tx, PAYOUT_LOCK);
    const run = await tx.payoutRun.findUnique({ where: { id: runId }, include: { earnings: true } });
    if (!run) throw new PayoutError("That month isn't closed (any more).");
    if (run.earnings.some((e) => e.paidAt || e.transferStartedAt)) {
      throw new PayoutError("Artists in this month have already been paid, so it can't be reopened.");
    }
    await tx.subscriptionPayment.updateMany({ where: { payoutRunId: runId }, data: { payoutRunId: null } });
    await tx.purchase.updateMany({ where: { payoutRunId: runId }, data: { payoutRunId: null } });
    await tx.reserveEntry.deleteMany({ where: { payoutRunId: runId } });
    await tx.payoutRun.delete({ where: { id: runId } });
  }, LONG_TX);
}

/**
 * Transfers each artist's earnings to their Stripe Connect account. Artists
 * who have not connected an account yet keep their balance until they do.
 * Each earning is claimed before its transfer, so it is never sent twice.
 */
export async function payRun(runId: string) {
  return db.$transaction(async (tx) => {
    await lock(tx, PAYOUT_LOCK);
    const run = await tx.payoutRun.findUnique({
      where: { id: runId },
      include: { earnings: { where: { paidAt: null, transferStartedAt: null, totalCents: { gt: 0 } }, include: { artist: true } } },
    });
    if (!run) throw new PayoutError("That month isn't closed (any more).");
    let paid = 0;
    for (const e of run.earnings) {
      if (!e.artist.stripeAccountId || !e.artist.payoutsEnabled) continue;
      const claim = await tx.artistEarning.updateMany({
        where: { id: e.id, paidAt: null, transferStartedAt: null },
        data: { transferStartedAt: new Date() },
      });
      if (claim.count !== 1) continue;
      // The idempotency key makes Stripe refuse a second transfer for the
      // same earning even if this request is retried after a failure.
      const transferId = await transferToArtist(e.artist.stripeAccountId, e.totalCents, `castalia-${run.month}`, `earning-${e.id}`);
      await tx.artistEarning.update({ where: { id: e.id }, data: { stripeTransferId: transferId, paidAt: new Date() } });
      paid++;
    }
    const unpaid = await tx.artistEarning.count({ where: { payoutRunId: runId, paidAt: null, totalCents: { gt: 0 } } });
    if (unpaid === 0) await tx.payoutRun.update({ where: { id: runId }, data: { status: "PAID" } });
    return { paid, waiting: unpaid };
  }, LONG_TX);
}
