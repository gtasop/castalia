import { db } from "../db";
import { monthRange } from "../money";
import { transferToArtist } from "../payments";
import { calculateRun } from "./engine";

/**
 * Closes a month: allocates every subscription payment whose period ended
 * in that month, plus album sales made in it, and records each artist's
 * earnings. Money is sent separately with `payRun`.
 */
export async function createPayoutRun(month: string) {
  const { start, end } = monthRange(month);
  const now = new Date();
  if (await db.payoutRun.findUnique({ where: { month } })) throw new Error(`${month} has already been closed.`);

  const payments = await db.subscriptionPayment.findMany({
    where: { payoutRunId: null, periodEnd: { gte: start, lt: end, lte: now } },
  });

  const paymentInputs = [];
  for (const p of payments) {
    const plays = await db.play.groupBy({
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

  const hosting = await db.hostingCost.findUnique({ where: { month } });
  const fallbackArtists = await db.artist.findMany({ where: { albums: { some: { published: true } } }, select: { id: true } });
  const result = calculateRun({
    hostingCostCents: hosting?.amountCents ?? 0,
    payments: paymentInputs,
    fallbackArtistIds: fallbackArtists.map((a) => a.id),
  });

  const purchases = await db.purchase.findMany({
    where: { payoutRunId: null, createdAt: { gte: start, lt: end } },
    include: { album: { select: { artistId: true } } },
  });
  const sales: Record<string, number> = {};
  for (const p of purchases) sales[p.album.artistId] = (sales[p.album.artistId] ?? 0) + p.netCents;

  const artistIds = new Set([...Object.keys(result.artists), ...Object.keys(sales)]);

  return db.$transaction(async (tx) => {
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
    await tx.subscriptionPayment.updateMany({ where: { id: { in: payments.map((p) => p.id) } }, data: { payoutRunId: run.id } });
    await tx.purchase.updateMany({ where: { id: { in: purchases.map((p) => p.id) } }, data: { payoutRunId: run.id } });
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
  });
}

/** Undo a closed month that has not paid anyone yet. */
export async function deletePayoutRun(runId: string) {
  const run = await db.payoutRun.findUniqueOrThrow({ where: { id: runId }, include: { earnings: true } });
  if (run.earnings.some((e) => e.paidAt)) throw new Error("Some artists in this run have already been paid.");
  await db.$transaction([
    db.subscriptionPayment.updateMany({ where: { payoutRunId: runId }, data: { payoutRunId: null } }),
    db.purchase.updateMany({ where: { payoutRunId: runId }, data: { payoutRunId: null } }),
    db.reserveEntry.deleteMany({ where: { payoutRunId: runId } }),
    db.payoutRun.delete({ where: { id: runId } }),
  ]);
}

/**
 * Transfers each artist's earnings to their Stripe Connect account. Artists
 * who have not connected an account yet keep their balance until they do.
 */
export async function payRun(runId: string) {
  const run = await db.payoutRun.findUniqueOrThrow({
    where: { id: runId },
    include: { earnings: { where: { paidAt: null, totalCents: { gt: 0 } }, include: { artist: true } } },
  });
  let paid = 0;
  for (const e of run.earnings) {
    if (!e.artist.stripeAccountId || !e.artist.payoutsEnabled) continue;
    const transferId = await transferToArtist(e.artist.stripeAccountId, e.totalCents, `castalia-${run.month}`, `earning-${e.id}`);
    await db.artistEarning.update({ where: { id: e.id }, data: { stripeTransferId: transferId, paidAt: new Date() } });
    paid++;
  }
  const unpaid = await db.artistEarning.count({ where: { payoutRunId: runId, paidAt: null, totalCents: { gt: 0 } } });
  if (unpaid === 0) await db.payoutRun.update({ where: { id: runId }, data: { status: "PAID" } });
  return { paid, waiting: unpaid };
}
