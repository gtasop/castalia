import { ActionForm } from "@/components/action-form";
import { Notice, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { donate } from "../actions";

export const metadata = { title: "Where the money goes" };

export default async function TransparencyPage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const sp = await searchParams;
  const [pay, sales, reserve, runs, earnings, paidOut] = await Promise.all([
    db.subscriptionPayment.aggregate({ where: { payoutRunId: { not: null } }, _sum: { grossCents: true, taxCents: true, feeCents: true, netCents: true } }),
    db.purchase.aggregate({ where: { payoutRunId: { not: null } }, _sum: { grossCents: true, netCents: true } }),
    db.reserveEntry.aggregate({ _sum: { amountCents: true } }),
    db.payoutRun.findMany({ orderBy: { month: "desc" }, include: { earnings: true, payments: { select: { netCents: true } } } }),
    db.artistEarning.aggregate({ _sum: { totalCents: true } }),
    db.artistEarning.aggregate({ where: { paidAt: { not: null } }, _sum: { totalCents: true } }),
  ]);
  const hosting = runs.reduce((a, r) => a + r.hostingCoveredCents, 0);

  return (
    <div className="space-y-10">
      <div className="max-w-2xl">
        <h1 className="h1">Where the money goes</h1>
        <p className="mt-3 text-muted">Castalia makes no profit. These numbers come straight from the payout ledger.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Earned by artists" value={formatEur(earnings._sum.totalCents ?? 0)} hint={`${formatEur(paidOut._sum.totalCents ?? 0)} paid out so far; the rest waits for artists to connect payouts`} />
        <Stat label="Hosting paid from subscriptions" value={formatEur(hosting)} hint="Never more than 20% of a subscription" />
        <Stat label="Hosting reserve" value={formatEur(reserve._sum.amountCents ?? 0)} hint="Donations, minus hosting above the 20% cap" />
      </section>

      <section className="max-w-2xl">
        <h2 className="h2">How a subscription is split</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>VAT goes to the tax office, and the card processor takes its fee.</li>
          <li>
            Each subscriber pays an equal share of that month&apos;s actual hosting bill, but <strong>never more than 20%</strong> of what is
            left. If hosting costs more than that, the difference comes from a reserve funded by donations, not from artists.
          </li>
          <li>
            Everything else goes to the artists <strong>that subscriber</strong> played for 30 seconds or more, split by their own plays.
            Your money never goes to music you did not listen to.
          </li>
          <li>If a subscriber plays nothing in a month, their share goes to a fund split across all artists by plays.</li>
        </ol>
        <h2 className="h2 mt-8">Album sales</h2>
        <p className="mt-2 text-sm">The artist sets the price and receives all of it except VAT and the card fee. No hosting deduction.</p>
      </section>

      {runs.length > 0 && (
        <section>
          <h2 className="h2">Month by month</h2>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[32rem] text-sm tabular-nums">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-normal">Month</th>
                <th className="font-normal">Subscriptions (net)</th>
                <th className="font-normal">Hosting bill</th>
                <th className="font-normal">From reserve</th>
                <th className="font-normal">To artists</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 whitespace-nowrap">{r.month}</td>
                  <td>{formatEur(r.payments.reduce((a, p) => a + p.netCents, 0))}</td>
                  <td>{formatEur(r.hostingCostCents)}</td>
                  <td>{formatEur(r.reserveDrawCents)}</td>
                  <td className="font-medium">{formatEur(r.earnings.reduce((a, e) => a + e.totalCents, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="mt-2 text-xs text-muted">
            Lifetime, closed months: {formatEur(pay._sum.grossCents ?? 0)} in subscriptions, {formatEur(pay._sum.taxCents ?? 0)} VAT,{" "}
            {formatEur(pay._sum.feeCents ?? 0)} card fees. {formatEur(sales._sum.grossCents ?? 0)} in album sales.
          </p>
        </section>
      )}

      <section className="card max-w-xl">
        <h2 className="h2">Support the hosting reserve</h2>
        <p className="mt-1 text-sm text-muted">Donations only ever pay for hosting above the 20% cap, so artists keep at least 80%.</p>
        <Notice success={sp.thanks ? "Thank you for your donation!" : undefined} />
        <ActionForm action={donate} className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input className="input" name="amount" inputMode="decimal" defaultValue="10.00" aria-label="Donation in euros" />
            <button className="btn shrink-0">Donate</button>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
