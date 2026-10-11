import { handleStripeEvent, stripe } from "@/lib/payments";

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response("Stripe is not configured", { status: 404 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    event = s.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  await handleStripeEvent(event);
  return Response.json({ received: true });
}
