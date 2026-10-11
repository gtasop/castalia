import Link from "next/link";
import { Notice } from "@/components/ui";
import { requireArtist } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { isDemoMode, refreshArtistAccount } from "@/lib/payments";
import { connectPayouts } from "../../actions";

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ connected?: string }> }) {
  const { connected } = await searchParams;
  const { artist: a } = await requireArtist();
  if (connected) await refreshArtistAccount(a.id);
  const artist = await db.artist.findUniqueOrThrow({ where: { id: a.id } });
  const earnings = await db.artistEarning.findMany({
    where: { artistId: artist.id },
    include: { payoutRun: true },
    orderBy: { payoutRun: { month: "desc" } },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/studio" className="text-sm text-muted hover:text-fg">← Studio</Link>
        <h1 className="h1">Payouts</h1>
      </div>

      <section className="card">
        <h2 className="h2">Payout account</h2>
        {artist.payoutsEnabled ? (
          <p className="mt-2 text-sm">
            Connected{isDemoMode() ? " (demo)" : " via Stripe"}. Earnings are sent to you after each month is closed.
          </p>
        ) : (
          <>
            <Notice error={connected ? "Stripe still needs some details before payouts can start." : undefined} />
            <p className="mt-2 text-sm text-muted">
              Connect a Stripe account to receive money. Your earnings are kept safe until you do.
            </p>
            <form action={connectPayouts} className="mt-4">
              <button className="btn">{artist.stripeAccountId ? "Finish setting up payouts" : "Set up payouts"}</button>
            </form>
          </>
        )}
      </section>

      <section>
        <h2 className="h2">Earnings by month</h2>
        {earnings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing yet. Earnings appear after each month is closed.</p>
        ) : (
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-normal">Month</th>
                <th className="font-normal">Listeners</th>
                <th className="font-normal">Shared fund</th>
                <th className="font-normal">Album sales</th>
                <th className="font-normal">Total</th>
                <th className="font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {earnings.map((e) => (
                <tr key={e.id}>
                  <td className="py-2">{e.payoutRun.month}</td>
                  <td>{formatEur(e.subscriptionCents)}</td>
                  <td>{formatEur(e.sharedFundCents)}</td>
                  <td>{formatEur(e.salesCents)}</td>
                  <td className="font-medium">{formatEur(e.totalCents)}</td>
                  <td className="text-muted">{e.paidAt ? "Paid" : artist.payoutsEnabled ? "Sending soon" : "Waiting for payout account"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
