# Castalia

A minimal, lossless music platform where the artist gets the money.

- **Subscriptions** are pay-what-you-want, from €5 a month.
- **Albums** can be bought outright. The buyer streams them in the app forever and downloads DRM-free FLAC (16-bit or hi-res) or MP3.
- **No profit.** Only VAT, card fees and the actual hosting bill are deducted, and hosting is capped at 20%. Everything else goes to artists.

Named after the Castalian Spring at Delphi, the sacred spring of the Muses.

## How the money is split

For each paid subscription month:

1. **VAT** goes to the tax office and the **card processor** takes its fee.
2. The subscriber pays an **equal share of that month's hosting bill**, but never more than **20%** of what is left. If hosting costs more than that, the shortfall is drawn from a **reserve funded by donations**. It never comes out of the artists' share.
3. The rest is split between the artists **that subscriber** played. Only plays of **30 seconds or more** count, and each artist gets a share proportional to their plays (user-centric).
4. If a subscriber plays nothing that month, their share goes to a **shared fund**, split across all artists by their share of all plays.

**Album sales** go to the artist minus VAT and the card fee, with no hosting deduction.

Listeners see a statement of where every cent went. Artists see their earnings by month, and the public `/transparency` page shows the totals.

The calculation is a pure, unit-tested function: [`src/lib/payouts/engine.ts`](src/lib/payouts/engine.ts).

## Audio

Artists upload lossless masters (FLAC, WAV, AIFF or ALAC). ffmpeg transcodes each one into:

| Format | Used for |
| --- | --- |
| FLAC at the original resolution (up to 24-bit / 192 kHz) | Hi-Res streaming and download, only when the master is hi-res |
| FLAC 16-bit / 44.1 kHz (long-filter resample, dithered) | Lossless streaming and download |
| AAC 256 kbps | "Data saver" streaming |
| MP3 320 kbps | Download |

Listeners choose Hi-Res, Lossless or Data saver in the player.

The uploaded master is only stored when none of the FLAC files is a bit-exact copy of it (checked by comparing the decoded samples). That is the case for 16-bit/48 kHz or 32-bit float masters. For the usual 16/44.1 and hi-res uploads, a FLAC file already preserves every sample, so storing the master too would add about 40% to the album's storage.

Album downloads are zips, built the first time a buyer asks for one in a given format. The zip is kept in storage and later downloads are served straight from there, so albums that never sell take up no extra space. Changing an album's tracks or titles makes its cached zips stale, and they are rebuilt on the next download.

## Hosting costs

Estimate for a 45-minute, 11-track album on Cloudflare R2 ($0.015 per GB-month, no egress fees):

| Album | Stored | Per month |
| --- | --- | --- |
| CD quality (16/44.1) | ~0.5 GB | ~$0.008 |
| Hi-res 24/96 | ~1.4 GB | ~$0.022 |
| Hi-res 24/192 | ~2.2 GB | ~$0.033 |

Streaming only costs R2's read requests: about $0.00001 for a full album play, in any quality. The same play from Amazon S3, which charges ~$0.09/GB for egress, would cost $0.03 (lossless) to $0.15 (24/192). For a heavy hi-res listener that is more than the 20% hosting cap on a subscription. **R2, or another provider without egress fees, is what makes the cap work.**

The hosting bill is therefore mostly fixed costs (the app server and database) plus storage that grows with the catalogue. Example: 1,000 albums and 1,000 subscribers cost about €60 a month, or €0.06 per subscriber, so artists receive ~99% of each net subscription.

## Running it locally

Requirements: Node 20+. Postgres and ffmpeg come from npm, so nothing else needs to be installed.

```bash
npm install
cp .env.example .env  # Windows cmd: copy .env.example .env
npm run db            # local Postgres on :5433, keep it running
npx prisma migrate dev
npm run seed          # demo accounts + albums with generated audio
npm run dev           # http://localhost:3000
```

Without Stripe keys the app runs in **demo mode**: payments succeed instantly, with Stripe's standard EU card fee simulated. The admin page has a button that ends subscription periods early, so a full payout cycle can be tried without waiting a month.

Demo accounts are listed at the top of [`scripts/seed.ts`](scripts/seed.ts).

### Trying a full cycle

1. Log in as the listener, subscribe and play a track for 30+ seconds. Buy an album and download it.
2. Log in as an artist and set up payouts in **Studio → Payouts**.
3. Log in as the admin, enter a hosting bill, click **Demo: end all subscription periods now**, close the month and pay the artists.
4. Back as the listener, **Account** shows where the money went.

## Production setup

- **Database:** any Postgres (for example Neon or Supabase). Set `DATABASE_URL` and run `npx prisma migrate deploy`.
- **Storage:** set `STORAGE_DRIVER=s3` and point it at an S3-compatible bucket. Cloudflare R2 is recommended because it has no egress fees, which keeps the hosting bill small. Audio is then served to listeners through short-lived signed URLs.
- **Payments:** set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, enable Stripe Connect (Express accounts), and send these webhook events to `/api/stripe/webhook`:
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `account.updated`

  Turn on Stripe Tax and set `STRIPE_TAX=1` to charge the correct VAT for each customer's country (EU OSS).
- **Transcoding and zip building:** both run in the web process (after an upload, and on the first download of an album zip). On serverless hosting with short time limits, or with many uploads, move `processTrack` and `requestZip` to a background worker.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db` | Local Postgres (embedded, data in `.pgdata/`) |
| `npm run seed` | Demo data |
| `npm run dev` | Dev server |
| `npm test` | Payout engine tests |
| `npm run build` | Production build |

## Not built yet

- Mobile and desktop apps, including offline downloads for subscribers
- Search, playlists, following artists
- Moderation and copyright claims for uploads
- Fraud detection beyond the basics: there is a 30s minimum per play, one counted play per track per track length, and artists' plays of their own music don't count
- Password reset and email verification
