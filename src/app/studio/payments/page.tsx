import Link from "next/link";
import { Notice, Stat } from "@/components/ui";
import { requireArtist } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { isDemoMode, refreshArtistAccount } from "@/lib/payments";
import { connectPayments } from "../../actions";

export const metadata = { title: "Payments" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ connected?: string }> }) {
  const { connected } = await searchParams;
  const { artist: a } = await requireArtist("/studio/payments");
  if (connected) await refreshArtistAccount(a.id);
  const artist = await db.artist.findUniqueOrThrow({ where: { id: a.id } });
  const sales = await db.purchase.findMany({
    where: { album: { artistId: artist.id } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { album: { select: { id: true, title: true } } },
  });
  const total = sales.reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/studio" className="text-sm text-muted hover:text-fg">← Studio</Link>
        <h1 className="h1">Payments</h1>
        <p className="mt-2 max-w-prose text-muted">
          Buyers pay you directly, into your own Stripe account. Castalia takes nothing and never holds your money. Stripe&apos;s card
          fee comes off each sale, and as the seller you handle VAT and refunds from your Stripe dashboard.
        </p>
      </div>

      <section className="card">
        <h2 className="h2">Your Stripe account</h2>
        {artist.paymentsEnabled ? (
          <p className="mt-2 text-sm">
            Connected{isDemoMode() ? " (demo mode: no real payments)" : ""}. Your albums can be bought.{" "}
            {!isDemoMode() && (
              <a className="link" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
                Open your Stripe dashboard
              </a>
            )}
          </p>
        ) : (
          <>
            <Notice error={connected ? "Stripe still needs some details before you can take payments." : undefined} />
            <p className="mt-2 text-sm text-muted">
              {isDemoMode()
                ? "Demo mode: your albums can be bought without a Stripe account and no money moves. Connect to try the real flow."
                : "Until you connect a Stripe account, your albums can't be bought. Open tracks and previews still play."}
            </p>
            <form action={connectPayments} className="mt-4">
              <button className="btn">{artist.stripeAccountId ? "Finish setting up payments" : "Connect Stripe"}</button>
            </form>
          </>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Stat label="Albums sold" value={String(sales.length)} />
        <Stat label="Paid to you" value={formatEur(total)} hint="Before Stripe's card fee and your VAT" />
      </section>

      <section>
        <h2 className="h2">Sales</h2>
        {sales.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No sales yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm tabular-nums">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-normal">Date</th>
                  <th className="font-normal">Album</th>
                  <th className="text-right font-normal">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sales.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 whitespace-nowrap">{dateFmt.format(p.createdAt)}</td>
                    <td className="[overflow-wrap:anywhere]">
                      <Link href={`/album/${p.album.id}`} className="link">
                        {p.album.title}
                      </Link>
                    </td>
                    <td className="text-right">{formatEur(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
