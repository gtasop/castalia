import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { ThemePicker } from "@/components/theme";
import { Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEur } from "@/lib/money";
import { toThemePref } from "@/lib/theme";
import { cancel, resume } from "../actions";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export const metadata = { title: "Your account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string; cancelled?: string; resumed?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const sub = user.subscription;

  // The open period: who your money is heading to so far.
  const open = sub
    ? await db.subscriptionPayment.findFirst({ where: { userId: user.id, payoutRunId: null }, orderBy: { periodStart: "desc" } })
    : null;
  const openPlays = open
    ? await db.play.groupBy({
        by: ["artistId"],
        where: { userId: user.id, playedAt: { gte: open.periodStart, lt: open.periodEnd } },
        _count: { _all: true },
      })
    : [];
  const openArtists = await db.artist.findMany({ where: { id: { in: openPlays.map((p) => p.artistId) } }, select: { id: true, name: true } });
  const totalOpenPlays = openPlays.reduce((a, p) => a + p._count._all, 0);

  const statements = await db.subscriptionPayment.findMany({
    where: { userId: user.id, payoutRunId: { not: null } },
    orderBy: { periodStart: "desc" },
    include: { allocations: { include: { artist: { select: { id: true, name: true } } }, orderBy: { amountCents: "desc" } } },
  });

  const purchases = await db.purchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { album: { include: { artist: true } } },
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="h1">Your account</h1>
        <Notice
          success={
            sp.welcome
              ? "Welcome to Castalia! Everything is now streamable in full quality."
              : sp.cancelled && user.subscription
                ? `Your subscription is cancelled. You can keep listening until ${dateFmt.format(user.subscription.currentPeriodEnd)}, and nothing more will be charged.`
                : sp.resumed
                  ? "Your subscription continues. It renews as before."
                  : undefined
          }
        />
      </div>

      <section className="card">
        <h2 className="h2">Subscription</h2>
        {!sub || sub.status === "CANCELED" ? (
          <p className="mt-2 text-sm text-muted">
            No active subscription. <Link className="link" href="/subscribe">Subscribe from €5 / month</Link>
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              {formatEur(sub.amountCents)} / month ·{" "}
              {sub.status === "PAST_DUE" ? (
                <span className="text-danger">payment failed</span>
              ) : sub.cancelAtPeriodEnd ? (
                <>ends {dateFmt.format(sub.currentPeriodEnd)}</>
              ) : (
                <>renews {dateFmt.format(sub.currentPeriodEnd)}</>
              )}
            </p>
            {sub.cancelAtPeriodEnd ? (
              <form action={resume}>
                <button className="btn-ghost">Keep subscription</button>
              </form>
            ) : (
              <form action={cancel}>
                <ConfirmButton
                  className="btn-ghost"
                  message={`Cancel your subscription? You keep listening until ${dateFmt.format(sub.currentPeriodEnd)}, then it stops.`}
                >
                  Cancel subscription
                </ConfirmButton>
              </form>
            )}
          </div>
        )}
      </section>

      {open && (
        <section>
          <h2 className="h2">This period so far</h2>
          <p className="mt-1 text-sm text-muted">
            {dateFmt.format(open.periodStart)} – {dateFmt.format(open.periodEnd)}. Of your {formatEur(open.grossCents)},{" "}
            {formatEur(open.taxCents)} is VAT and {formatEur(open.feeCents)} the card fee. At least {formatEur(Math.ceil(open.netCents * 0.8))} will
            go to artists, split like this unless you listen to more:
          </p>
          {totalOpenPlays === 0 ? (
            <p className="mt-3 text-sm text-muted">No counted plays yet. If it stays that way, your share goes to the fund shared by all artists.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {openPlays
                .sort((a, b) => b._count._all - a._count._all)
                .map((p) => {
                  const share = p._count._all / totalOpenPlays;
                  return (
                    <li key={p.artistId} className="text-sm">
                      <div className="flex justify-between">
                        <Link href={`/artist/${p.artistId}`} className="link">
                          {openArtists.find((a) => a.id === p.artistId)?.name}
                        </Link>
                        <span className="tabular-nums text-muted">
                          {p._count._all} {p._count._all === 1 ? "play" : "plays"} · {Math.round(share * 100)}%
                        </span>
                      </div>
                      <div className="meter mt-1">
                        <div style={{ width: `${share * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      )}

      {statements.length > 0 && (
        <section>
          <h2 className="h2">Where your money went</h2>
          <div className="mt-3 space-y-4">
            {statements.map((s) => (
              <div key={s.id} className="card text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">
                    {dateFmt.format(s.periodStart)} – {dateFmt.format(s.periodEnd)}
                  </span>
                  <span className="text-muted">You paid {formatEur(s.grossCents)}</span>
                </div>
                <table className="mt-3 w-full tabular-nums">
                  <tbody className="divide-y divide-line">
                    <tr>
                      <td className="py-1.5 text-muted">VAT</td>
                      <td className="text-right">{formatEur(s.taxCents)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-muted">Card fee</td>
                      <td className="text-right">{formatEur(s.feeCents)}</td>
                    </tr>
                    {s.allocations.map((a) => (
                      <tr key={a.id}>
                        <td className="py-1.5">
                          {a.kind === "HOSTING" && <span className="text-muted">Hosting (your share)</span>}
                          {a.kind === "SHARED_FUND" && "Shared artist fund"}
                          {a.kind === "ARTIST_PLAYS" && a.artist && (
                            <>
                              <Link href={`/artist/${a.artist.id}`} className="link">{a.artist.name}</Link>{" "}
                              <span className="text-muted">· {a.plays} {a.plays === 1 ? "play" : "plays"}</span>
                            </>
                          )}
                        </td>
                        <td className="text-right">{formatEur(a.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="h2">Appearance</h2>
        <p className="mt-1 text-sm text-muted">System follows your device&apos;s light or dark setting. Your choice is saved to your account.</p>
        <ThemePicker theme={toThemePref(user.theme)} />
      </section>

      <section>
        <h2 className="h2">Your albums</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Albums you buy are yours to stream and download, DRM-free.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {purchases.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <Link href={`/album/${p.albumId}`} className="link">
                  {p.album.title} <span className="text-muted">· {p.album.artist.name}</span>
                </Link>
                <span className="text-muted">{formatEur(p.grossCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
