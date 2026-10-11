import "server-only";
import Stripe from "stripe";
import { db } from "./db";
import { addMonths, simulatedCardFee, vatIncluded } from "./money";

// Payments run through Stripe when STRIPE_SECRET_KEY is set. Without it the
// app runs in demo mode: payments succeed instantly, with Stripe's standard
// EU card fee simulated, so the full money flow can be tried locally.

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const isDemoMode = () => !stripe();
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const stripeTax = () => process.env.STRIPE_TAX === "1";

/** Tax as reported by Stripe, or the VAT contained in a VAT-inclusive price. */
function taxFor(grossCents: number, stripeReportedTax: number | null | undefined) {
  return stripeReportedTax && stripeReportedTax > 0 ? stripeReportedTax : vatIncluded(grossCents);
}

function amounts(grossCents: number, feeCents: number, reportedTax?: number | null) {
  const taxCents = taxFor(grossCents, reportedTax);
  return { grossCents, taxCents, feeCents, netCents: grossCents - taxCents - feeCents };
}

// ---------------------------------------------------------------- checkout

/** Returns the URL to send the user to. */
export async function startSubscription(userId: string, email: string, amountCents: number): Promise<string> {
  const s = stripe();
  if (!s) {
    const now = new Date();
    const end = addMonths(now, 1);
    const sub = await db.subscription.upsert({
      where: { userId },
      create: { userId, amountCents, currentPeriodStart: now, currentPeriodEnd: end },
      update: { amountCents, status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodStart: now, currentPeriodEnd: end },
    });
    await db.subscriptionPayment.create({
      data: { subscriptionId: sub.id, userId, periodStart: now, periodEnd: end, ...amounts(amountCents, simulatedCardFee(amountCents)) },
    });
    return "/account?welcome=1";
  }
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          recurring: { interval: "month" },
          tax_behavior: "inclusive",
          product_data: { name: "Castalia subscription" },
        },
      },
    ],
    automatic_tax: { enabled: stripeTax() },
    metadata: { kind: "subscription", userId },
    subscription_data: { metadata: { userId } },
    success_url: `${appUrl()}/account?welcome=1`,
    cancel_url: `${appUrl()}/subscribe`,
  });
  return session.url!;
}

export async function startAlbumPurchase(userId: string, email: string, albumId: string): Promise<string> {
  const album = await db.album.findUniqueOrThrow({ where: { id: albumId }, include: { artist: true } });
  const s = stripe();
  if (!s) {
    await db.purchase.upsert({
      where: { userId_albumId: { userId, albumId } },
      create: { userId, albumId, ...amounts(album.priceCents, simulatedCardFee(album.priceCents)) },
      update: {},
    });
    return `/album/${albumId}?bought=1`;
  }
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: album.priceCents,
          tax_behavior: "inclusive",
          product_data: { name: `${album.title} by ${album.artist.name}` },
        },
      },
    ],
    automatic_tax: { enabled: stripeTax() },
    metadata: { kind: "album", userId, albumId },
    success_url: `${appUrl()}/album/${albumId}?bought=1`,
    cancel_url: `${appUrl()}/album/${albumId}`,
  });
  return session.url!;
}

export async function startDonation(userId: string | null, amountCents: number): Promise<string> {
  const s = stripe();
  if (!s) {
    const fee = simulatedCardFee(amountCents);
    await recordDonation(userId, amountCents, fee, null);
    return "/transparency?thanks=1";
  }
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amountCents, product_data: { name: "Donation to the Castalia hosting reserve" } } }],
    metadata: { kind: "donation", userId: userId ?? "" },
    success_url: `${appUrl()}/transparency?thanks=1`,
    cancel_url: `${appUrl()}/transparency`,
  });
  return session.url!;
}

export async function cancelSubscription(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return;
  const s = stripe();
  if (s && sub.stripeSubscriptionId) {
    await s.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  }
  await db.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: true } });
}

export async function resumeSubscription(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return;
  const s = stripe();
  if (s && sub.stripeSubscriptionId) {
    await s.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
  }
  await db.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd: false } });
}

async function recordDonation(userId: string | null, grossCents: number, feeCents: number, stripeSessionId: string | null) {
  // Donations are not taxable supplies, so no VAT is deducted.
  const netCents = grossCents - feeCents;
  await db.$transaction(async (tx) => {
    await tx.donation.create({ data: { userId: userId || null, grossCents, feeCents, netCents, stripeSessionId } });
    await tx.reserveEntry.create({ data: { kind: "DONATION", amountCents: netCents, note: "Donation" } });
  });
}

// ------------------------------------------------------------- demo tools

/**
 * Demo only: ends every open subscription period now and renews active
 * subscriptions, so payouts can be tried without waiting a month.
 */
export async function demoEndPeriodsNow() {
  if (!isDemoMode()) throw new Error("Only available in demo mode");
  const now = new Date();
  const subs = await db.subscription.findMany({ where: { stripeSubscriptionId: null } });
  for (const sub of subs) {
    await db.subscriptionPayment.updateMany({
      where: { subscriptionId: sub.id, payoutRunId: null, periodEnd: { gt: now } },
      data: { periodEnd: now },
    });
    if (sub.status !== "ACTIVE" || sub.cancelAtPeriodEnd) {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED", currentPeriodEnd: now } });
      continue;
    }
    const end = addMonths(now, 1);
    await db.subscription.update({ where: { id: sub.id }, data: { currentPeriodStart: now, currentPeriodEnd: end } });
    await db.subscriptionPayment.create({
      data: { subscriptionId: sub.id, userId: sub.userId, periodStart: now, periodEnd: end, ...amounts(sub.amountCents, simulatedCardFee(sub.amountCents)) },
    });
  }
}

// ---------------------------------------------------------------- webhooks

async function feeForPaymentIntent(s: Stripe, paymentIntentId: string | null | undefined): Promise<number> {
  if (!paymentIntentId) return 0;
  const pi = await s.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
  const charge = pi.latest_charge as Stripe.Charge | null;
  const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null | undefined;
  return bt?.fee ?? 0;
}

function idOf(x: string | { id: string } | null | undefined): string | null {
  return typeof x === "string" ? x : (x?.id ?? null);
}

export async function handleStripeEvent(event: Stripe.Event) {
  const s = stripe()!;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const meta = session.metadata ?? {};
      if (meta.kind === "album" && meta.userId && meta.albumId) {
        const fee = await feeForPaymentIntent(s, idOf(session.payment_intent));
        await db.purchase.upsert({
          where: { userId_albumId: { userId: meta.userId, albumId: meta.albumId } },
          create: {
            userId: meta.userId,
            albumId: meta.albumId,
            stripeSessionId: session.id,
            ...amounts(session.amount_total ?? 0, fee, session.total_details?.amount_tax),
          },
          update: {},
        });
      } else if (meta.kind === "donation") {
        if (await db.donation.findUnique({ where: { stripeSessionId: session.id } })) break;
        const fee = await feeForPaymentIntent(s, idOf(session.payment_intent));
        await recordDonation(meta.userId || null, session.amount_total ?? 0, fee, session.id);
      } else if (meta.kind === "subscription" && meta.userId) {
        const subId = idOf(session.subscription);
        if (subId) await syncSubscription(await s.subscriptions.retrieve(subId), meta.userId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    case "invoice.paid": {
      const invoice = event.data.object;
      if (!invoice.id || (await db.subscriptionPayment.findUnique({ where: { stripeInvoiceId: invoice.id } }))) break;
      const subId = idOf(invoice.parent?.subscription_details?.subscription);
      if (!subId) break;
      let sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: subId } });
      if (!sub) {
        // invoice.paid can arrive before checkout.session.completed.
        const remote = await s.subscriptions.retrieve(subId);
        if (!remote.metadata.userId) break;
        await syncSubscription(remote, remote.metadata.userId);
        sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: subId } });
        if (!sub) break;
      }
      const payments = await s.invoicePayments.list({ invoice: invoice.id, limit: 1 });
      const fee = await feeForPaymentIntent(s, idOf(payments.data[0]?.payment.payment_intent));
      const tax = (invoice.total_taxes ?? []).reduce((a, t) => a + t.amount, 0);
      const line = invoice.lines.data[0];
      await db.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          userId: sub.userId,
          stripeInvoiceId: invoice.id,
          periodStart: new Date((line?.period.start ?? invoice.period_start) * 1000),
          periodEnd: new Date((line?.period.end ?? invoice.period_end) * 1000),
          ...amounts(invoice.amount_paid, fee, tax),
        },
      });
      break;
    }
    case "account.updated": {
      const account = event.data.object;
      await db.artist.updateMany({ where: { stripeAccountId: account.id }, data: { payoutsEnabled: account.payouts_enabled ?? false } });
      break;
    }
  }
}

async function syncSubscription(sub: Stripe.Subscription, userId?: string) {
  const item = sub.items.data[0];
  const status = sub.status === "active" || sub.status === "trialing" ? "ACTIVE" : sub.status === "past_due" ? "PAST_DUE" : "CANCELED";
  const data = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: idOf(sub.customer),
    amountCents: item?.price.unit_amount ?? 0,
    status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodStart: new Date((item?.current_period_start ?? sub.start_date) * 1000),
    currentPeriodEnd: new Date((item?.current_period_end ?? sub.start_date) * 1000),
  } as const;
  const uid = userId ?? sub.metadata.userId;
  if (!uid) return;
  await db.subscription.upsert({ where: { userId: uid }, create: { userId: uid, ...data }, update: data });
}

// ------------------------------------------------------------ Stripe Connect

export async function artistOnboardingUrl(artistId: string): Promise<string> {
  const s = stripe();
  const artist = await db.artist.findUniqueOrThrow({ where: { id: artistId }, include: { user: true } });
  if (!s) {
    await db.artist.update({ where: { id: artistId }, data: { stripeAccountId: `demo_${artistId}`, payoutsEnabled: true } });
    return "/studio/payouts?connected=1";
  }
  let accountId = artist.stripeAccountId;
  if (!accountId) {
    const account = await s.accounts.create({
      type: "express",
      email: artist.user.email,
      capabilities: { transfers: { requested: true } },
      metadata: { artistId },
    });
    accountId = account.id;
    await db.artist.update({ where: { id: artistId }, data: { stripeAccountId: accountId } });
  }
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/studio/payouts`,
    return_url: `${appUrl()}/studio/payouts?connected=1`,
  });
  return link.url;
}

export async function refreshArtistAccount(artistId: string) {
  const s = stripe();
  const artist = await db.artist.findUnique({ where: { id: artistId } });
  if (!s || !artist?.stripeAccountId) return;
  const account = await s.accounts.retrieve(artist.stripeAccountId);
  await db.artist.update({ where: { id: artistId }, data: { payoutsEnabled: account.payouts_enabled ?? false } });
}

/** Sends money to an artist's connected account. Returns the transfer id. */
export async function transferToArtist(stripeAccountId: string, amountCents: number, group: string, idempotencyKey: string) {
  const s = stripe();
  if (!s) return `demo_tr_${idempotencyKey}`;
  const t = await s.transfers.create(
    { amount: amountCents, currency: "eur", destination: stripeAccountId, transfer_group: group },
    { idempotencyKey },
  );
  return t.id;
}
