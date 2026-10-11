import { Notice, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur, monthKey } from "@/lib/money";
import { isDemoMode } from "@/lib/payments";
import { closeMonth, demoEndPeriods, payArtists, reopenMonth, setHostingCost } from "../actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paid?: string; waiting?: string; ended?: string }>;
}) {
  const sp = await searchParams;
  await requireAdmin();
  const now = new Date();
  const [costs, runs, reserve, ready, activeSubs] = await Promise.all([
    db.hostingCost.findMany({ orderBy: { month: "desc" }, take: 12 }),
    db.payoutRun.findMany({ orderBy: { month: "desc" }, include: { earnings: { include: { artist: true } }, _count: { select: { payments: true, purchases: true } } } }),
    db.reserveEntry.aggregate({ _sum: { amountCents: true } }),
    db.subscriptionPayment.findMany({ where: { payoutRunId: null, periodEnd: { lte: now } }, select: { periodEnd: true, netCents: true } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
  ]);

  // Months with finished subscription periods that have not been closed yet.
  const readyByMonth = new Map<string, { count: number; net: number }>();
  for (const p of ready) {
    const m = monthKey(p.periodEnd);
    const e = readyByMonth.get(m) ?? { count: 0, net: 0 };
    readyByMonth.set(m, { count: e.count + 1, net: e.net + p.netCents });
  }
  const success =
    sp.paid !== undefined
      ? `Paid ${sp.paid} artist(s).${Number(sp.waiting) ? ` ${sp.waiting} still need to connect a payout account.` : ""}`
      : sp.ended
        ? "All open demo periods ended now and active subscriptions renewed."
        : undefined;

  return (
    <div className="space-y-10">
      <h1 className="h1">Admin</h1>
      <Notice error={sp.error} success={success} />

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active subscriptions" value={String(activeSubs)} />
        <Stat label="Hosting reserve" value={formatEur(reserve._sum.amountCents ?? 0)} hint={(reserve._sum.amountCents ?? 0) < 0 ? "In deficit: ask for donations" : undefined} />
        <Stat label="Payments ready to allocate" value={String(ready.length)} />
      </section>

      <section>
        <h2 className="h2">1. Enter the hosting bill</h2>
        <p className="mt-1 text-sm text-muted">The actual cloud cost for a month (storage, bandwidth, servers). Only this is deducted from subscriptions.</p>
        <form action={setHostingCost} className="card mt-3 grid gap-3 sm:grid-cols-[140px_140px_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="month">Month</label>
            <input className="input" id="month" name="month" placeholder="2026-10" defaultValue={monthKey(now)} required />
          </div>
          <div>
            <label className="label" htmlFor="amount">Cost (EUR)</label>
            <input className="input" id="amount" name="amount" inputMode="decimal" required />
          </div>
          <div>
            <label className="label" htmlFor="note">Note</label>
            <input className="input" id="note" name="note" placeholder="R2 + Vercel + database" />
          </div>
          <button className="btn">Save</button>
        </form>
        {costs.length > 0 && (
          <ul className="mt-3 text-sm">
            {costs.map((c) => (
              <li key={c.id} className="flex gap-4 py-1">
                <span className="w-20">{c.month}</span>
                <span className="w-24 tabular-nums">{formatEur(c.amountCents)}</span>
                <span className="text-muted">{c.note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="h2">2. Close a month</h2>
        <p className="mt-1 text-sm text-muted">
          Allocates every subscription whose paid period ended in that month, plus that month&apos;s album sales. Close a month once it is
          over and its hosting bill is in.
        </p>
        {readyByMonth.size === 0 ? (
          <p className="mt-3 text-sm text-muted">No finished subscription periods waiting.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...readyByMonth.entries()].sort().map(([m, v]) => (
              <li key={m} className="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <strong>{m}</strong> · {v.count} payments · {formatEur(v.net)} net
                  {!costs.some((c) => c.month === m) && <span className="text-danger"> · no hosting bill entered</span>}
                </span>
                <form action={closeMonth}>
                  <input type="hidden" name="month" value={m} />
                  <button className="btn">Close {m}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {isDemoMode() && (
          <form action={demoEndPeriods} className="mt-4">
            <button className="btn-ghost">Demo: end all subscription periods now</button>
            <p className="mt-1 text-xs text-muted">Skips waiting a month: open periods end now and active subscriptions renew.</p>
          </form>
        )}
      </section>

      <section>
        <h2 className="h2">3. Pay artists</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No closed months yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {runs.map((r) => {
              const total = r.earnings.reduce((a, e) => a + e.totalCents, 0);
              const unpaid = r.earnings.filter((e) => !e.paidAt && e.totalCents > 0);
              const payable = unpaid.filter((e) => e.artist.payoutsEnabled);
              return (
                <div key={r.id} className="card text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong>{r.month}</strong> · {r._count.payments} subscriptions · {r._count.purchases} album sales · hosting{" "}
                      {formatEur(r.hostingCoveredCents)} from subscriptions, {formatEur(r.reserveDrawCents)} from reserve
                    </div>
                    <div className="flex gap-2">
                      {unpaid.length === r.earnings.filter((e) => e.totalCents > 0).length && (
                        <form action={reopenMonth}>
                          <input type="hidden" name="runId" value={r.id} />
                          <button className="btn-ghost">Reopen</button>
                        </form>
                      )}
                      {payable.length > 0 && (
                        <form action={payArtists}>
                          <input type="hidden" name="runId" value={r.id} />
                          <button className="btn">Pay {formatEur(payable.reduce((a, e) => a + e.totalCents, 0))}</button>
                        </form>
                      )}
                    </div>
                  </div>
                  <table className="mt-3 w-full tabular-nums">
                    <tbody className="divide-y divide-line">
                      {r.earnings.map((e) => (
                        <tr key={e.id}>
                          <td className="py-1.5">{e.artist.name}</td>
                          <td className="text-right">{formatEur(e.totalCents)}</td>
                          <td className="w-48 text-right text-muted">
                            {e.paidAt ? "Paid" : e.artist.payoutsEnabled ? "Ready" : "No payout account"}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-1.5 font-medium">Total</td>
                        <td className="text-right font-medium">{formatEur(total)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
