import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { currentUser, hasActiveSubscription } from "@/lib/auth";
import { formatEur, simulatedCardFee, vatIncluded, vatRate } from "@/lib/money";
import { subscribe } from "../actions";

const EXAMPLES = [500, 800, 1200];

export const metadata = { title: "Subscribe" };

export default async function SubscribePage() {
  const user = await currentUser();
  if (!user) redirect("/signup?next=%2Fsubscribe");
  if (hasActiveSubscription(user)) redirect("/account");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="h1">Pay what you want</h1>
      <p className="mt-3 text-muted">
        Everything on Castalia in lossless and hi-res, from €5 a month. Pay more if you can: every extra cent goes to the artists you
        listen to.
      </p>
      <ActionForm action={subscribe} className="card mt-6 space-y-4">
        <label className="label" htmlFor="amount">Monthly amount (EUR, VAT included)</label>
        <div className="flex gap-2">
          <input className="input text-lg" id="amount" name="amount" inputMode="decimal" defaultValue="8.00" required />
          <button className="btn shrink-0">Subscribe</button>
        </div>
        <p className="text-xs text-muted">From €5.00 to €100.00. Cancel any time; you keep access until the end of the month you paid for.</p>
      </ActionForm>

      <h2 className="h2 mt-10">Where your money goes</h2>
      <p className="mt-1 text-sm text-muted">
        Estimates with {Math.round(vatRate() * 100)}% VAT and the standard card fee. Hosting is your equal share of the real bill, and
        never more than 20% of what is left.
      </p>
      <table className="mt-4 w-full text-sm tabular-nums">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-2 font-normal">You pay</th>
            <th className="font-normal">VAT</th>
            <th className="font-normal">Card fee</th>
            <th className="font-normal">Max. hosting</th>
            <th className="font-normal">Min. to artists</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {EXAMPLES.map((g) => {
            const vat = vatIncluded(g);
            const fee = simulatedCardFee(g);
            const net = g - vat - fee;
            const host = Math.floor(net * 0.2);
            return (
              <tr key={g}>
                <td className="py-2">{formatEur(g)}</td>
                <td>{formatEur(vat)}</td>
                <td>{formatEur(fee)}</td>
                <td>{formatEur(host)}</td>
                <td className="font-medium">{formatEur(net - host)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-muted">
        Your share goes only to the artists you played for 30 seconds or more, split by how much you played each. In a month you listen
        to nothing, it goes to a fund shared by all artists. <Link href="/transparency" className="link">How it works</Link>
      </p>
    </div>
  );
}
