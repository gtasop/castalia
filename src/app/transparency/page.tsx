import Link from "next/link";
import { Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { donateUrl } from "@/lib/donations";
import { formatEur } from "@/lib/money";

export const metadata = { title: "How it's fair" };

// Rough running costs, shown so donors know what they cover. Storage is
// measured live; the server and domain are fixed monthly estimates.
const SERVER_EUR_PER_MONTH = 600; // small VPS, ~€5–8
const DOMAIN_EUR_PER_MONTH = 100; // ~€12 a year
const STORAGE_CENTS_PER_GB_MONTH = 1.4; // Cloudflare R2, $0.015/GB, no download fees

export default async function TransparencyPage() {
  const [sales, artists, albums, files] = await Promise.all([
    db.purchase.aggregate({ _sum: { amountCents: true }, _count: { _all: true } }),
    db.artist.count({ where: { albums: { some: { published: true } } } }),
    db.album.count({ where: { published: true } }),
    db.trackFile.aggregate({ _sum: { bytes: true } }),
  ]);
  const gb = (files._sum.bytes ?? 0) / 1024 ** 3;
  const storageCents = Math.ceil(gb * STORAGE_CENTS_PER_GB_MONTH);
  const monthlyCents = SERVER_EUR_PER_MONTH + DOMAIN_EUR_PER_MONTH + storageCents;
  const donate = donateUrl();

  return (
    <div className="space-y-10">
      <div className="max-w-2xl">
        <h1 className="h1">How it&apos;s fair</h1>
        <p className="mt-3 text-muted">Castalia never touches the money for music, and makes no profit. Here is how it works.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid straight to artists" value={formatEur(sales._sum.amountCents ?? 0)} hint={`${sales._count._all} albums bought`} />
        <Stat label="Artists" value={String(artists)} hint={`${albums} published albums`} />
        <Stat label="Running costs" value={`~${formatEur(monthlyCents)}`} hint="per month, covered by donations" />
      </section>

      <section className="max-w-2xl space-y-6">
        <div>
          <h2 className="h2">You pay the artist, not us</h2>
          <p className="mt-2 text-sm">
            When you buy an album, you pay the artist directly, into their own Stripe account. Castalia doesn&apos;t receive the money,
            doesn&apos;t take a cut and doesn&apos;t hand anything out later. The receipt comes from the artist. The only deduction is
            Stripe&apos;s card fee (about 1.5% + €0.25 for European cards), and the artist handles VAT as the seller.
          </p>
        </div>
        <div>
          <h2 className="h2">Listening</h2>
          <p className="mt-2 text-sm">
            Every album has a 15-second preview, and artists choose which tracks every listener may hear in full. Buy an album to stream all of
            it here and download it DRM-free, yours to keep even if the artist later takes it down.
          </p>
        </div>
        <div>
          <h2 className="h2">Running costs</h2>
          <p className="mt-2 text-sm">
            The server, storage and domain cost about {formatEur(monthlyCents)} a month right now: roughly{" "}
            {formatEur(SERVER_EUR_PER_MONTH)} for the server, {formatEur(DOMAIN_EUR_PER_MONTH)} for the domain and{" "}
            {formatEur(storageCents)} for {gb.toFixed(1)} GB of music in storage. Streaming and downloads cost almost nothing, because the
            storage provider charges no download fees.
          </p>
          <p className="mt-2 text-sm">
            These costs are paid only by donations{donate ? ", collected on a public page where every euro in and out is listed" : ""}.
            Donations never buy anything on Castalia and never go to anyone&apos;s profit.
          </p>
          {donate ? (
            <a href={donate} className="btn mt-4" target="_blank" rel="noreferrer">
              Donate towards running costs
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted">The donation page isn&apos;t set up yet.</p>
          )}
        </div>
        <p className="text-sm">
          <Link href="/albums" className="link">
            Browse albums →
          </Link>
        </p>
      </section>
    </div>
  );
}
