# Castalia

A minimal, lossless music platform where the artist gets the money.

- **Buy from the artist.** Albums are bought straight from the artist: the buyer pays into the artist's own Stripe account. Castalia never holds the money and takes nothing.
- **Listen first.** Every album has a 15-second preview, and artists choose which tracks listeners can hear in full.
- **Keep what you buy.** A bought album unlocks every track for streaming here, and DRM-free downloads in FLAC (16-bit or hi-res) or MP3.
- **No profit.** The running costs (server, storage, domain) are paid by donations through an external page such as Open Collective.

Named after the Castalian Spring at Delphi, the sacred spring of the Muses.

## How the money works

**Album sales.** Each artist connects their own Stripe account (a *Standard* account they fully own). When someone buys an album, the Checkout session is created on the artist's account as a *direct charge*, with no platform fee:

- The artist is the seller of record: the receipt comes from them, Stripe's card fee comes off their sale, and they handle VAT, refunds and disputes in their own Stripe dashboard.
- Castalia only receives a webhook saying the payment succeeded, and records the purchase so the buyer can stream and download the album. A full refund by the artist removes the purchase.
- Because Castalia never collects or redistributes money, it doesn't need to be a payment intermediary.

**Running costs.** These are covered only by donations, collected on an external page set in `DONATE_URL`. A fiscal host such as Open Collective Europe can hold them for a project without its own legal entity, and publishes every euro in and out. Donations never buy anything on Castalia.

The `/transparency` page ("How it's fair") explains this and shows what has been paid to artists and roughly what Castalia costs to run, with the storage cost measured live.

## Listening

| Who | What they hear |
| --- | --- |
| Visitors without an account | Nothing of the albums: the home page invites them to join |
| Anyone logged in | The 15-second preview of every album, and every track its artist made **open** |
| Buyers of the album, and its artist | Every track, in full, plus downloads |

Artists choose the preview (track and start time) and mark tracks open in the album editor. A purchase is for keeps: the buyer keeps the album even if the artist later unpublishes it.

## Accounts

People sign up with an email and password, or with Google. New Google users only pick listener or artist and their name; they log in with Google and have no password.

Castalia doesn't verify email addresses, so Google is never connected to an existing account automatically: someone could have signed up with another person's email. The owner logs in with their password and connects Google from their account page instead.

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

Album downloads are zips, built the first time a buyer asks for one in a given format. The zip is kept in storage and later downloads are served straight from there, so albums that never sell take up no extra space.

## Browsing, previews and genres

`/albums` lets anyone logged in browse albums, with search (accent- and case-insensitive), genre and hi-res filters and sorting by price.

Every album has a **15-second preview**. The artist picks the track and start time; without a choice, the preview comes from track 1, starting 30 seconds in. Previews are separate AAC clips (~450 KB), so locked tracks are never exposed.

Artists can tag an album with up to 3 **genres** from a fixed list ([`src/lib/genres.ts`](src/lib/genres.ts)).

## Hosting costs

Rough monthly costs when self-hosted:

| Item | Choice | Per month |
| --- | --- | --- |
| Server (app, database, ffmpeg) | Small VPS, 2 vCPU / 4 GB | €5–8 |
| Audio storage | Cloudflare R2, $0.015 per GB, first 10 GB free | ~€0.01 per CD-quality album, ~€0.02 per hi-res album |
| Streaming and downloads | R2 has no download fees | ~€0 |
| Domain | | ~€1 |
| Payment fees | Paid by the artist on each sale | €0 |

About €7–10 a month at the start, and €20–25 with a thousand albums.

## Running it locally

Requirements: Node 20+. Postgres and ffmpeg come from npm, so nothing else needs to be installed.

```bash
npm install
cp .env.example .env  # Windows cmd: copy .env.example .env
npm run db            # local Postgres on :5433 (UTF-8), keep it running
npx prisma migrate dev
npm run seed          # demo accounts + albums with generated audio
npm run dev           # http://localhost:3000
```

Without Stripe keys the app runs in **demo mode**: connecting payments and buying albums succeed instantly, and no money moves. Demo accounts are listed at the top of [`scripts/seed.ts`](scripts/seed.ts).

To try it: as an artist, connect payments in **Studio → Payments**, mark a track open in the album editor; as a listener, play the open track and the preview, buy the album and download it.

## Production setup

- **Database:** any Postgres (for example Neon or Supabase), UTF-8. Set `DATABASE_URL` and run `npx prisma migrate deploy`.
- **Storage:** set `STORAGE_DRIVER=s3` and point it at an S3-compatible bucket. Cloudflare R2 is recommended because it has no download fees. Audio is then served through short-lived signed URLs.
- **Payments:** create a Stripe account for the platform, enable Connect, and set `STRIPE_SECRET_KEY`. Add a **Connect** webhook endpoint (events from connected accounts) for `/api/stripe/webhook` with these events, and set its secret as `STRIPE_CONNECT_WEBHOOK_SECRET`:
  - `checkout.session.completed`
  - `charge.refunded`
  - `account.updated`
- **Google sign-in (optional):** in Google Cloud Console, create an OAuth client ID of type *Web application*, add `https://your-domain/api/auth/google/callback` as an authorised redirect URI, and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The "Continue with Google" buttons appear once both are set. For local testing, add `http://localhost:3000/api/auth/google/callback` too (Google doesn't accept LAN addresses such as `http://192.168.…`).
- **Donations:** set `DONATE_URL` to your donation page (for example your Open Collective page).
- **`SESSION_SECRET`:** set a long random value; it signs error messages passed in URLs.
- **Transcoding and zip building** run in the web process. On serverless hosting with short time limits, or with many uploads, move `processTrack` and `requestZip` to a background worker.
- **Rate limits** (login, sign-up) are kept in memory, which is enough for one server.

### Known, accepted dependency advisories

`npm audit` still reports postcss (bundled inside Next.js, only used at build time on Castalia's own CSS) and deepmerge-ts (inside Prisma's CLI config loader). Neither is reachable by users of the running app; the fixes need major upgrades, so they wait for those.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db` | Local Postgres (embedded, data in `.pgdata/`) |
| `npm run seed` | Demo data |
| `npm run dev` | Dev server |
| `npm test` | Unit tests |
| `npm run build` | Production build |

## Not built yet

- Mobile and desktop apps, including offline listening
- Playlists, following artists
- Moderation and copyright claims for uploads
- Password reset and email verification (Google sign-in covers the email side for its users)
