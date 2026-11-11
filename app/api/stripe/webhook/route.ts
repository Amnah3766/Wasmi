import { fulfillCheckoutSession } from '@/lib/checkout';
import { errorResponse, json } from '@/lib/http';
import type { CheckoutSession } from '@/lib/stripe';
import { verifyStripeSignature } from '@/lib/stripeCore';

export const dynamic = 'force-dynamic';

// POST /api/stripe/webhook — Stripe → Wasmi (bonus). No cookie: the request is trusted ONLY if its Stripe-Signature
// header is a valid HMAC of the RAW body with STRIPE_WEBHOOK_SECRET (400 otherwise; 503 if the secret is not set).
// checkout.session.completed / async_payment_succeeded with payment_status "paid" → the order is saved as "paid".
// Idempotent: Stripe may deliver the same event more than once; the order is still saved once.
const HANDLED = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return json({ error: 'Webhook is not configured.' }, 503); // Stripe retries later
  try {
    const payload = await request.text(); // raw body: parsing first would break the signature
    const check = verifyStripeSignature(payload, request.headers.get('stripe-signature'), secret, Math.floor(Date.now() / 1000));
    if (!check.ok) return json({ error: 'Invalid signature.', reason: check.reason }, 400);

    let event: { type?: string; data?: { object?: CheckoutSession } };
    try {
      event = JSON.parse(payload);
    } catch {
      return json({ error: 'Invalid payload.' }, 400);
    }
    if (!event.type || !HANDLED.has(event.type)) return json({ received: true, ignored: true });

    const session = event.data?.object;
    if (!session || session.object !== 'checkout.session') return json({ received: true, ignored: true });
    if (session.payment_status !== 'paid') return json({ received: true, pending: true });

    const result = await fulfillCheckoutSession(session);
    if (!result.ok) {
      // Not ours / does not match what the server created: acknowledge so Stripe stops retrying, and log it.
      console.error(`[webhook] session not fulfilled: ${result.reason}`);
      return json({ received: true, fulfilled: false });
    }
    return json({ received: true, fulfilled: true, created: result.created });
  } catch (error) {
    return errorResponse(error); // 5xx → Stripe retries the delivery
  }
}
