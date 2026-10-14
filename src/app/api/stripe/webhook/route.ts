import type Stripe from "stripe";
import { handleStripeEvent, stripe } from "@/lib/payments";

// Purchases happen on the artists' own Stripe accounts, so their events
// arrive through a Connect webhook endpoint (signed with its own secret).
// STRIPE_WEBHOOK_SECRET is kept for an account-level endpoint, if any.
export async function POST(req: Request) {
  const s = stripe();
  const secrets = [process.env.STRIPE_CONNECT_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET].filter(Boolean) as string[];
  if (!s || secrets.length === 0) return new Response("Stripe is not configured", { status: 404 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = s.webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) return new Response("Invalid signature", { status: 400 });
  await handleStripeEvent(event);
  return Response.json({ received: true });
}
