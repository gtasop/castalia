import "server-only";
import Stripe from "stripe";
import { db } from "./db";

// Castalia never holds money. Each artist connects their own Stripe account
// (a "Standard" account they fully own) and buyers pay the artist directly:
// the Checkout session is created *on the artist's account* (a direct
// charge) with no platform fee. The artist is the seller of record, so the
// receipt, Stripe's fee, VAT, refunds and disputes are theirs; Castalia only
// records the purchase so the buyer can stream and download the album.
//
// Without STRIPE_SECRET_KEY the app runs in demo mode: purchases succeed
// instantly and no money moves.

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const isDemoMode = () => !stripe();
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** The artist can't take payments yet (no connected Stripe account). */
export class ArtistCannotSell extends Error {
  constructor() {
    super("This artist hasn't set up payments yet, so the album can't be bought right now.");
  }
}

type AlbumForSale = { id: string; title: string; priceCents: number; artist: { name: string; stripeAccountId: string | null; paymentsEnabled: boolean } };

export function canSell(artist: { stripeAccountId: string | null; paymentsEnabled: boolean }) {
  return isDemoMode() || (!!artist.stripeAccountId && artist.paymentsEnabled);
}

type PurchaseRecord = {
  userId: string;
  albumId: string;
  amountCents: number;
  stripeAccountId?: string | null;
  stripeSessionId?: string;
  stripePaymentIntentId?: string | null;
};

async function recordPurchase(data: PurchaseRecord) {
  try {
    await db.purchase.create({ data });
  } catch (e) {
    // Already recorded (webhook and return page, or a double click).
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
}

const intentId = (pi: string | Stripe.PaymentIntent | null) => (typeof pi === "string" ? pi : (pi?.id ?? null));

/** Returns the URL to send the buyer to. */
/**
 * `waivedAt` is when the buyer asked for immediate access and accepted losing
 * the EU 14-day right to cancel; it travels with the payment as proof.
 */
export async function startAlbumPurchase(userId: string, email: string, album: AlbumForSale, waivedAt: Date): Promise<string> {
  const s = stripe();
  if (!s) {
    await recordPurchase({ userId, albumId: album.id, amountCents: album.priceCents });
    return `/album/${album.id}?bought=1`;
  }
  if (!canSell(album.artist)) throw new ArtistCannotSell();
  const metadata = { kind: "album", userId, albumId: album.id, immediate_access_requested_at: waivedAt.toISOString() };
  const session = await s.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "eur", unit_amount: album.priceCents, product_data: { name: `${album.title} by ${album.artist.name}` } },
        },
      ],
      metadata,
      // On the artist's receipt too, so the buyer has the consent in writing.
      payment_intent_data: {
        metadata,
        description: `${album.title} by ${album.artist.name}. Digital album, delivered immediately at the buyer's request; the 14-day right to cancel ends once payment is complete.`,
      },
      custom_text: {
        submit: { message: "Your album unlocks straight away. As you agreed, the 14-day right to cancel ends once payment is complete." },
      },
      success_url: `${appUrl()}/album/${album.id}?bought=1&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/album/${album.id}`,
    },
    { stripeAccount: album.artist.stripeAccountId! },
  );
  return session.url!;
}

/**
 * When the buyer comes back from Checkout, confirm the session directly, so
 * the album unlocks even if the webhook hasn't arrived yet.
 */
export async function confirmCheckout(sessionId: string, albumId: string, userId: string) {
  const s = stripe();
  if (!s || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  const album = await db.album.findUnique({ where: { id: albumId }, select: { artist: { select: { stripeAccountId: true } } } });
  const account = album?.artist.stripeAccountId;
  if (!account) return;
  const session = await s.checkout.sessions.retrieve(sessionId, { stripeAccount: account }).catch(() => null);
  if (!session || session.payment_status !== "paid") return;
  const meta = session.metadata ?? {};
  if (meta.kind !== "album" || meta.albumId !== albumId || meta.userId !== userId) return;
  await recordPurchase({
    userId,
    albumId,
    amountCents: session.amount_total ?? 0,
    stripeAccountId: account,
    stripeSessionId: session.id,
    stripePaymentIntentId: intentId(session.payment_intent),
  });
}

/** Events from the artists' connected accounts (event.account is set). */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const meta = session.metadata ?? {};
      if (meta.kind !== "album" || !meta.userId || !meta.albumId || session.payment_status !== "paid") break;
      await recordPurchase({
        userId: meta.userId,
        albumId: meta.albumId,
        amountCents: session.amount_total ?? 0,
        stripeAccountId: event.account ?? null,
        stripeSessionId: session.id,
        stripePaymentIntentId: intentId(session.payment_intent),
      });
      break;
    }
    case "charge.refunded": {
      // A full refund by the artist takes the album back.
      const charge = event.data.object;
      const pi = intentId(charge.payment_intent);
      if (pi && charge.refunded) await db.purchase.deleteMany({ where: { stripePaymentIntentId: pi } });
      break;
    }
    case "account.updated": {
      const account = event.data.object;
      await db.artist.updateMany({ where: { stripeAccountId: account.id }, data: { paymentsEnabled: account.charges_enabled ?? false } });
      break;
    }
  }
}

// ------------------------------------------------------------ Stripe Connect

/** Where to send an artist to connect (or finish connecting) their own Stripe account. */
export async function artistOnboardingUrl(artistId: string): Promise<string> {
  const s = stripe();
  const artist = await db.artist.findUniqueOrThrow({ where: { id: artistId }, include: { user: true } });
  if (!s) {
    await db.artist.update({ where: { id: artistId }, data: { stripeAccountId: `demo_${artistId}`, paymentsEnabled: true } });
    return "/studio/payments?connected=1";
  }
  let accountId = artist.stripeAccountId;
  if (!accountId) {
    // A Standard account belongs to the artist: their own Stripe dashboard,
    // payouts to their own bank, and they can disconnect from Castalia.
    const account = await s.accounts.create({ type: "standard", email: artist.user.email, metadata: { artistId } });
    accountId = account.id;
    await db.artist.update({ where: { id: artistId }, data: { stripeAccountId: accountId } });
  }
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/studio/payments`,
    return_url: `${appUrl()}/studio/payments?connected=1`,
  });
  return link.url;
}

export async function refreshArtistAccount(artistId: string) {
  const s = stripe();
  const artist = await db.artist.findUnique({ where: { id: artistId } });
  if (!s || !artist?.stripeAccountId) return;
  const account = await s.accounts.retrieve(artist.stripeAccountId);
  await db.artist.update({ where: { id: artistId }, data: { paymentsEnabled: account.charges_enabled ?? false } });
}
